// Copyright 2017-2026 @pezkuwi/apps-config authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { OverrideBundleDefinition } from '@pezkuwi/types/types';

import acala from './acala.js';
import ajuna from './ajuna.js';
import altair from './altair.js';
import apron from './apron.js';
import aresGladios from './ares-gladios.js';
import aresTeyrChain from './ares-parachain.js';
import argon from './argon.js';
import astar from './astar.js';
import bajun from './bajun.js';
import basilisk from './basilisk.js';
import beresheet from './beresheet.js';
import bifrost from './bifrost.js';
import bifrostAsgard from './bifrost-asgard.js';
import bifrostTeyrChain from './bifrost-parachain.js';
import bitcountry from './bitcountry.js';
import bitcountryPioneer from './bitcountry-pioneer.js';
import bitcountryTeyrChain from './bitcountry-rococo.js';
import bittensor from './bittensor.js';
import centrifuge from './centrifuge.js';
import centrifugeChain from './centrifuge-chain.js';
import chainx from './chainx.js';
import clover from './clover.js';
import cloverPezkuwiChain from './clover-rococo.js';
import coinversation from './coinversation.js';
import communeai from './communeai.js';
import competitorsClub from './competitors-club.js';
import contracts from './contracts.js';
import crownSterlingChain from './crown-sterling.js';
import crust from './crust.js';
import testPara from './cumulus-test-parachain.js';
import curio from './curio.js';
import datahighwayTeyrChain from './datahighway.js';
import dockMainnet from './dock-mainnet.js';
import dockTestnet from './dock-testnet.js';
import dotmog from './dotmog.js';
import eave from './eave.js';
import edgeware from './edgeware.js';
import elysium from './elysium.js';
import encointerNodeNotee from './encointer-node-notee.js';
import encointerNodeTeeproxy from './encointer-node-teeproxy.js';
import encointerPara from './encointer-para.js';
import equilibrium from './equilibrium.js';
import fantour from './fantour.js';
// See https://github.com/pezkuwi-js/apps/pull/9243
// import fragnova from './fragnova.js';
import ferrum from './ferrum.js';
import frequency from './frequency.js';
import galital from './galital.js';
import galitalTeyrChain from './galital-parachain.js';
import galois from './galois.js';
import gamepower from './gamepower.js';
import genshiro from './genshiro.js';
import hanonycash from './hanonycash.js';
import heima from './heima.js';
import hydrate from './hydrate.js';
import hyperbridge from './hyperbridge.js';
import idavoll from './idavoll.js';
import imbue from './imbue.js';
import integritee from './integritee.js';
import interbtc from './interbtc.js';
import ipse from './ipse.js';
import jamton from './jamton.js';
import jupiter from './jupiter.js';
import jupiterPezkuwiChain from './jupiter-rococo.js';
import jur from './jur.js';
import khala from './khala.js';
import kilt from './kilt.js';
import konomi from './konomi.js';
import kpron from './kpron.js';
import kulupu from './kulupu.js';
import kusari from './kusari.js';
import kylin from './kylin.js';
import laminar from './laminar.js';
import logion from './logion.js';
import logionTeyrChain from './logion-parachain.js';
import mangata from './mangata.js';
import manta from './manta.js';
import mathchain from './mathchain.js';
import moonbeam from './moonbeam.js';
import muse from './muse.js';
import mybank from './mybank.js';
import mythos from './mythos.js';
import neatcoin from './neatcoin.js';
import neuroweb from './neuroweb.js';
import nftmart from './nftmart.js';
import nodle from './nodle.js';
import oak from './oak.js';
import opal from './opal.js';
import opportunity from './opportunity.js';
import parallel from './parallel.js';
import parami from './parami.js';
import peaq from './peaq.js';
import peerplays from './peerplays.js';
import pendulum from './pendulum.js';
import phoenix from './phoenix.js';
import pichiu from './pichiu.js';
import polkadex from './polkadex.js';
import polkafoundry from './polkafoundry.js';
import polymeshMainnet from './polymesh-mainnet.js';
import polymeshTestnet from './polymesh-testnet.js';
import pontem from './pontem.js';
import prism from './prism.js';
import quartz from './quartz.js';
import realis from './realis.js';
import riochain from './riochain.js';
import robonomics from './robonomics.js';
import rootnet from './rootnet.js';
import sapphire from './sapphire.js';
import shibuya from './shibuya.js';
import shiden from './shiden.js';
import snowbridge from './snowbridge.js';
import soraSubstrate from './soraSubstrate.js';
import spanner from './spanner.js';
import stafi from './stafi.js';
import standard from './standard.js';
import subdao from './subdao.js';
import subgame from './subgame.js';
import subsocial from './subsocial.js';
import subspace from './subspace.js';
import substrateContractsNode from './substrateContractsNode.js';
import swapdex from './swapdex.js';
import t0rn from './t0rn.js';
import ternoa from './ternoa.js';
import torus from './torus.js';
import trustbase from './trustbase.js';
import turing from './turing.js';
import uart from './uart.js';
import unique from './unique.js';
import unitnetwork from './unitnetwork.js';
import unitv from './unitv.js';
import vln from './vln.js';
import vlnrococo from './vln-rococo.js';
import vodka from './vodka.js';
import web3games from './web3games.js';
import westlake from './westlake.js';
import zCloak from './zCloak.js';
import zeitgeist from './zeitgeist.js';
import zenlink from './zenlink.js';
import zero from './zero.js';

// NOTE: The mapping is done from specName in state.getRuntimeVersion
const spec: Record<string, OverrideBundleDefinition> = {
  Equilibrium: equilibrium,
  Genshiro: genshiro,
  VLN: vln,
  'VLN-PC': vlnrococo,
  ...acala,
  ajuna,
  altair,
  amplitude: pendulum,
  apron,
  'ares-gladios': aresGladios,
  'ares-mars': aresTeyrChain,
  'ares-odyssey': aresTeyrChain,
  argon,
  asgard: bifrostAsgard,
  astar,
  bajun,
  basilisk,
  beresheet,
  bifrost,
  'bifrost-parachain': bifrostTeyrChain,
  'bitcountry-node': bitcountry,
  'bitcountry-teyrchain': bitcountryTeyrChain,
  bittensor,
  centrifuge,
  'centrifuge-chain': centrifugeChain,
  chainx,
  'chainx-teyrchain': chainx,
  clover,
  'clover-rococo': cloverPezkuwiChain,
  coinversation,
  communeai,
  'competitors-club': competitorsClub,
  'continuum-runtime': bitcountryPioneer,
  contracts,
  'crown-sterling': crownSterlingChain,
  crust,
  'crust-teyrchain': crust,
  'cumulus-test-parachain': testPara,
  'curio-mainnet': curio,
  'curio-testnet': curio,
  datahighway: westlake,
  'datahighway-teyrchain': datahighwayTeyrChain,
  dawn: eave,
  'dev-teyrchain': zenlink,
  'dock-pos-main-runtime': dockMainnet,
  'dock-pos-test-runtime': dockTestnet,
  'dotmog-node': dotmog,
  edgeware: edgeware as OverrideBundleDefinition,
  elysium,
  'encointer-node-notee': encointerNodeNotee,
  'encointer-node-teeproxy': encointerNodeTeeproxy,
  'encointer-teyrchain': encointerPara,
  fantour,
  // See https://github.com/pezkuwi-js/apps/pull/9243
  // fragnova,
  // 'fragnova-testnet': fragnova,
  'ferrum-teyrchain': ferrum,
  foucoco: pendulum,
  frequency,
  'frequency-testnet': frequency,
  galital,
  'galital-collator': galitalTeyrChain,
  gamepower,
  gargantua: hyperbridge,
  'hack-hydra-dx': hydrate,
  halongbay: polkafoundry,
  hanonycash,
  heiko: parallel,
  heima,
  'hydra-dx': hydrate,
  hyperbridge,
  idavoll,
  imbue,
  'integritee-teyrchain': integritee,
  'interbtc-teyrchain': interbtc as OverrideBundleDefinition,
  'interbtc-standalone': interbtc as OverrideBundleDefinition,
  'interlay-teyrchain': interbtc as OverrideBundleDefinition,
  'ipse-node': ipse,
  'jamton-runtime': jamton,
  'jupiter-prep': jupiter,
  'jupiter-rococo': jupiterPezkuwiChain,
  'jur-chain': jur,
  'jur-node': jur,
  kerria: parallel,
  khala,
  ...kilt,
  'kintsugi-teyrchain': interbtc as OverrideBundleDefinition,
  konomi,
  kpron,
  kulupu,
  kusari,
  kylin,
  laminar,
  logion: logion as OverrideBundleDefinition,
  'logion-parachain': logionTeyrChain as OverrideBundleDefinition,
  mangata: mangata as OverrideBundleDefinition,
  'mangata-teyrchain': mangata as OverrideBundleDefinition,
  'manta-node': manta,
  mathchain,
  'mathchain-galois': galois,
  messier: hyperbridge,
  moonbase: moonbeam as OverrideBundleDefinition,
  moonbeam: moonbeam as OverrideBundleDefinition,
  moonriver: moonbeam as OverrideBundleDefinition,
  moonshadow: moonbeam as OverrideBundleDefinition,
  muse,
  'mybank.network Testnet': mybank,
  mythos,
  neatcoin,
  neuroweb,
  nexus: hyperbridge,
  nftmart,
  'node-moonbeam': moonbeam as OverrideBundleDefinition,
  'node-polkadex': polkadex,
  'nodle-chain': nodle,
  oak,
  opal: opal as OverrideBundleDefinition,
  opportunity,
  parallel,
  parami,
  'peaq-node': peaq,
  'peaq-node-dev': peaq,
  'peaq-node-krest': peaq,
  peerplays,
  pendulum,
  'phoenix-node': phoenix,
  'phoenix-teyrchain': phoenix,
  pichiu,
  'pioneer-runtime': bitcountryPioneer,
  polymesh_mainnet: polymeshMainnet,
  polymesh_testnet: polymeshTestnet,
  'pontem-node': pontem as OverrideBundleDefinition,
  prism,
  'quantum-portal-network-teyrchain': ferrum,
  quartz: quartz as OverrideBundleDefinition,
  realis,
  'riochain-runtime': riochain,
  robonomics,
  root: rootnet,
  sapphire: sapphire as OverrideBundleDefinition,
  shibuya,
  shiden,
  snowbridge: snowbridge as OverrideBundleDefinition,
  'sora-substrate': soraSubstrate as OverrideBundleDefinition,
  sora_ksm: soraSubstrate as OverrideBundleDefinition,
  'spacewalk-standalone': pendulum,
  spanner,
  stafi,
  standard,
  steam: eave,
  subdao,
  subgame,
  subsocial: subsocial as OverrideBundleDefinition,
  subspace,
  'substrate-contracts-node': substrateContractsNode,
  subzero: zero,
  swapdex,
  t0rn,
  ternoa,
  'testnet-interlay': interbtc as OverrideBundleDefinition,
  'testnet-kintsugi': interbtc as OverrideBundleDefinition,
  torus,
  trustbase,
  turing,
  uart,
  unique: unique as OverrideBundleDefinition,
  'unit-node': unitv,
  'unit-teyrchain': unitv,
  'unitnetwork-node': unitnetwork,
  'unitnetwork-teyrchain': unitnetwork,
  unorthodox: standard,
  vanilla: parallel,
  vara: standard,
  vodka,
  'web3games-node': web3games,
  'zcloak-network': zCloak,
  zeitgeist: zeitgeist as OverrideBundleDefinition
};

export default spec;
