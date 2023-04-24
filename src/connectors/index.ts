import { initializeConnector, Web3ReactHooks } from '@web3-react/core'
import { Connector } from '@web3-react/types'

import { SodiumConnector } from './sodium'

export enum ConnectionType {
  SODIUM = 'SODIUM',
}

export interface Connection {
  connector: Connector
  hooks: Web3ReactHooks
  type: ConnectionType
}

function onError(error: Error) {
  console.debug(`web3-react error: ${error}`)
}

// @ts-ignore
const [web3Sodium, web3SodiumHooks] = initializeConnector<SodiumConnector>(
  (actions) =>
    new SodiumConnector({
      actions,
      config: {
        defaultNetworkId: 80001,
        walletAppURL: 'https://sodium-two.vercel.app',
        transports: {
          iframeTransport: {
            enabled: true,
          },
          // appTransport: {
          //   enabled: true,
          // },
        },
      },
    })
)
export const sodiumConnection: Connection = {
  connector: web3Sodium,
  hooks: web3SodiumHooks,
  type: ConnectionType.SODIUM,
}
