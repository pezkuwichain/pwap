import { ApiPromise, WsProvider } from '@pezkuwi/api';

// Same endpoint the rest of this ecosystem's tooling (pwap-web, PezbridgeBot) uses for Pezkuwi
// Asset Hub - the chain this multisig lives on.
const RPC_ENDPOINT = 'wss://asset-hub-rpc.pezkuwichain.io';

export function connectApi(): Promise<ApiPromise> {
  const provider = new WsProvider(RPC_ENDPOINT);
  return ApiPromise.create({ provider });
}
