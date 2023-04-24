import type { Actions } from '@web3-react/types'
import { Connector } from '@web3-react/types'
import type { sodium, Wallet } from '0xsodium'

class NoSodiumContext extends Error {
  public constructor(t: string) {
    super(`The app is loaded outside sodium context ${t}`)
    this.name = NoSodiumContext.name
    Object.setPrototypeOf(this, NoSodiumContext.prototype)
  }
}

// eslint-disable-next-line import/no-unused-modules
export interface SodiumConstructorArgs {
  actions: Actions
  config: sodium.ProviderConfig
}

// eslint-disable-next-line import/no-unused-modules
export class SodiumConnector extends Connector {
  private eagerConnection?: Promise<void>
  private config: sodium.ProviderConfig

  /**
   * A `Sodium wallet` instance.
   */
  private sdk: Wallet | undefined

  constructor({ actions, config }: SodiumConstructorArgs) {
    super(actions)
    this.config = config
  }

  /**
   * A function to determine whether or not this code is executing on a server.
   */
  private get serverSide() {
    return typeof window === 'undefined'
  }

  /**
   * A function to determine whether or not this code is executing in an iframe.
   */
  private get inSodium() {
    if (this.serverSide) return false
    if (this.config.transports?.iframeTransport?.enabled) return true
    if (window !== window.parent) return true
    if (window.__SODIUM__) return true
    return false
  }

  private async isomorphicInitialize(): Promise<void> {
    if (this.eagerConnection) return this.eagerConnection

    await (this.eagerConnection = import('0xsodium').then(async (m) => {
      this.sdk = await m.initWallet(undefined, this.config);

      // @ts-ignore
      this.provider = this.sdk.getProvider();
    }));
  }

  private async connect(): Promise<void> {
    if (!this.sdk) {
      throw new NoSodiumContext('connect no sdk 1')
    }
    await this.sdk.connect({
      app: 'test',
      // refresh: true,
      origin: window.location.origin,
      keepWalletOpened: false,
    })
  }

  public async deactivate(...args: unknown[]): Promise<void> {
    if (!this.sdk) throw new NoSodiumContext('deactivate no sdk')
    this.sdk.disconnect()
    this.actions.resetState();
  }

  /** {@inheritdoc Connector.connectEagerly} */
  public async connectEagerly(): Promise<void> {
    if (!this.inSodium) return

    const cancelActivation = this.actions.startActivation()

    try {
      await this.isomorphicInitialize()
      if (!this.sdk) throw new NoSodiumContext('connectEagerly not sdk')
      await this.connect()

      const updated = {
        chainId: await this.sdk.getChainId(),
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        accounts: [await this.sdk.getAddress()],
      }

      this.actions.update(updated)
    } catch (error) {
      cancelActivation()
      throw error
    }
  }

  public async activate(): Promise<void> {
    if (!this.inSodium) throw new NoSodiumContext('activate')

    // only show activation if this is a first-time connection
    let cancelActivation: () => void
    if (!this.sdk) cancelActivation = this.actions.startActivation()

    return this.isomorphicInitialize()
      .then(async () => {
        if (!this.provider) throw new NoSodiumContext('no provider')
        if (!this.sdk) throw new NoSodiumContext('no sdk')
        await this.connect()

        this.actions.update({
          chainId: await this.sdk.getChainId(),
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          accounts: [await this.sdk.getAddress()],
        })
      })
      .catch((error) => {
        cancelActivation?.()
        throw error
      })
  }
}