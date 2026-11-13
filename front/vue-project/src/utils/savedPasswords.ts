const DATABASE_NAME = 'assetExchangeLogin'
const PASSWORD_STORE = 'passwords'
const KEY_STORE = 'keys'
const KEY_ID = 'passwordEncryptionKey'

type EncryptedPassword = { iv: number[]; data: number[] }

const requestResult = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1)
    request.onupgradeneeded = () => {
      const database = request.result
      database.createObjectStore(PASSWORD_STORE)
      database.createObjectStore(KEY_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

const getKey = async (database: IDBDatabase, create: boolean): Promise<CryptoKey | undefined> => {
  const existing = await requestResult<CryptoKey | undefined>(
    database.transaction(KEY_STORE, 'readonly').objectStore(KEY_STORE).get(KEY_ID),
  )
  if (existing || !create) return existing

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  await requestResult(database.transaction(KEY_STORE, 'readwrite').objectStore(KEY_STORE).put(key, KEY_ID))
  return key
}

export const loadSavedPassword = async (account: string): Promise<string | null> => {
  if (!account || !crypto.subtle || !window.indexedDB) return null
  const database = await openDatabase()
  try {
    const key = await getKey(database, false)
    if (!key) return null
    const record = await requestResult<EncryptedPassword | undefined>(
      database.transaction(PASSWORD_STORE, 'readonly').objectStore(PASSWORD_STORE).get(account),
    )
    if (!record) return null
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(record.iv) },
      key,
      new Uint8Array(record.data),
    )
    return new TextDecoder().decode(plain)
  } finally {
    database.close()
  }
}

export const saveLoginPassword = async (account: string, password: string): Promise<void> => {
  if (!crypto.subtle || !window.indexedDB) throw new Error('当前页面无法保存密码，请使用 HTTPS 访问')
  const database = await openDatabase()
  try {
    const key = await getKey(database, true)
    if (!key) throw new Error('无法创建密码加密密钥')
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(password))
    await requestResult(
      database.transaction(PASSWORD_STORE, 'readwrite').objectStore(PASSWORD_STORE).put(
        { iv: Array.from(iv), data: Array.from(new Uint8Array(data)) },
        account,
      ),
    )
  } finally {
    database.close()
  }
}

export const removeSavedPassword = async (account: string): Promise<void> => {
  if (!window.indexedDB) return
  const database = await openDatabase()
  try {
    await requestResult(database.transaction(PASSWORD_STORE, 'readwrite').objectStore(PASSWORD_STORE).delete(account))
  } finally {
    database.close()
  }
}
