import express from 'express';
import cors from 'cors';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { ApiPromise, WsProvider } from '@pezkuwi/api';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const WS_ENDPOINT = process.env.WS_ENDPOINT || 'wss://rpc.pezkuwichain.io';

app.use(cors());
app.use(express.json());

// Initialize Database
async function initDb() {
    const db = await open({
        filename: './transactions.db',
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS transfers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hash TEXT UNIQUE,
            sender TEXT,
            receiver TEXT,
            amount TEXT,
            asset_id INTEGER DEFAULT NULL,
            symbol TEXT,
            block_number INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    return db;
}

// Start Indexing
async function startIndexer(db) {
    console.log(`Connecting to Pezkuwi Node: ${WS_ENDPOINT}`);
    const provider = new WsProvider(WS_ENDPOINT);
    const api = await ApiPromise.create({ provider });

    console.log('Connected! Listening for new blocks...');

    api.rpc.chain.subscribeNewHeads(async (header) => {
        const blockNumber = header.number.toNumber();
        const blockHash = await api.rpc.chain.getBlockHash(blockNumber);
        const signedBlock = await api.rpc.chain.getBlock(blockHash);

        signedBlock.block.extrinsics.forEach(async (ex) => {
            const { method: { method, section }, signer } = ex;

            // 1. Handle Native HEZ Transfers
            if (section === 'balances' && (method === 'transfer' || method === 'transferKeepAlive')) {
                const [dest, value] = ex.method.args;
                await saveTransfer(db, {
                    hash: ex.hash.toHex(),
                    sender: signer.toString(),
                    receiver: dest.toString(),
                    amount: value.toString(),
                    asset_id: null,
                    symbol: 'HEZ',
                    block_number: blockNumber
                });
            }

            // 2. Handle Asset Transfers (PEZ, USDT)
            if (section === 'assets' && method === 'transfer') {
                const [id, dest, value] = ex.method.args;
                const assetId = id.toNumber();
                const symbol = assetId === 1 ? 'PEZ' : assetId === 1000 ? 'USDT' : `ASSET-${assetId}`;
                
                await saveTransfer(db, {
                    hash: ex.hash.toHex(),
                    sender: signer.toString(),
                    receiver: dest.toString(),
                    amount: value.toString(),
                    asset_id: assetId,
                    symbol: symbol,
                    block_number: blockNumber
                });
            }
        });
    });
}

async function saveTransfer(db, tx) {
    try {
        await db.run(
            `INSERT OR IGNORE INTO transfers (hash, sender, receiver, amount, asset_id, symbol, block_number) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [tx.hash, tx.sender, tx.receiver, tx.amount, tx.asset_id, tx.symbol, tx.block_number]
        );
        console.log(`Indexed ${tx.symbol} Transfer: ${tx.hash.slice(0, 10)}...`);
    } catch (err) {
        console.error('DB Insert Error:', err);
    }
}

// API Routes
async function startServer(db) {
    app.get('/api/history/:address', async (req, res) => {
        const { address } = req.params;
        try {
            const history = await db.all(
                `SELECT * FROM transfers 
                 WHERE sender = ? OR receiver = ? 
                 ORDER BY block_number DESC LIMIT 50`,
                [address, address]
            );
            res.json(history);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.get('/api/stats', async (req, res) => {
        const stats = await db.get('SELECT COUNT(*) as total FROM transfers');
        res.json(stats);
    });

    app.listen(port, () => {
        console.log(`Indexer API running at http://localhost:${port}`);
    });
}

// Launch
const db = await initDb();
startIndexer(db);
startServer(db);
