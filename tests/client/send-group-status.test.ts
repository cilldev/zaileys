import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createMockSocket, type MockSocket } from '../_helpers/mock-socket.js'

const { makeWASocketMock, initAuthCredsMock } = vi.hoisted(() => ({
  makeWASocketMock: vi.fn(),
  initAuthCredsMock: vi.fn(() => ({ fake: 'creds' })),
}))

vi.mock('baileys', async () => {
  const actual = await vi.importActual<typeof import('baileys')>('baileys')
  return {
    ...actual,
    default: makeWASocketMock,
    makeWASocket: makeWASocketMock,
    initAuthCreds: initAuthCredsMock,
  }
})

import { Client } from '../../src/client/client.js'
import type { AuthStore, AuthStoreBundle } from '../../src/auth/types.js'

function memAuth(): AuthStoreBundle {
  const sig: AuthStore = {
    read: async () => ({}),
    write: async () => undefined,
    delete: async () => undefined,
    clear: async () => undefined,
    close: async () => undefined,
  }
  return {
    creds: {
      readCreds: async () => undefined,
      writeCreds: async () => undefined,
      deleteCreds: async () => undefined,
    },
    signal: sig,
  }
}

async function connected(): Promise<{ client: Client; sock: MockSocket }> {
  const sock = createMockSocket({ user: { id: '628111@s.whatsapp.net', name: 'Bot' } })
  makeWASocketMock.mockReturnValue(sock)
  const client = new Client({ auth: memAuth(), autoConnect: false, qrTerminal: false })
  const p = client.connect()
  sock.triggerConnectionUpdate({ connection: 'open' })
  await p
  return { client, sock }
}

beforeEach(() => {
  makeWASocketMock.mockReset()
  initAuthCredsMock.mockClear()
})

describe('Client — sendGroupStatus', () => {
  it('relays text groupStatusMessageV2 payload to target group JID', async () => {
    const { client, sock } = await connected()
    const targetGroup = '120363000000000000@g.us'

    await client.sendGroupStatus(targetGroup, { text: 'Hello Group Status!' })

    expect(sock.relayMessage).toHaveBeenCalledTimes(1)
    const [jid, msgPayload, opts] = sock.relayMessage.mock.calls[0]!
    expect(jid).toBe(targetGroup)
    expect(opts).toHaveProperty('messageId')
    expect(msgPayload).toHaveProperty('groupStatusMessageV2')
    const gsm = (msgPayload as any).groupStatusMessageV2.message
    expect(gsm).toHaveProperty('extendedTextMessage')
    expect(gsm.extendedTextMessage.text).toBe('Hello Group Status!')
  })
})
