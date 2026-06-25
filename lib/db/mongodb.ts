import { MongoClient, Db } from "mongodb"

const MONGODB_URI = process.env.MONGODB_URI as string
const MONGODB_DB  = process.env.MONGODB_DB ?? "digital_chef"

if (!MONGODB_URI && process.env.NODE_ENV === "production") {
  throw new Error("MONGODB_URI environment variable is not set.")
}

/**
 * Cache the MongoClient promise across hot-reloads in development
 * so we don't open a new connection on every request.
 */
declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

let clientPromise: Promise<MongoClient> | null = null

if (MONGODB_URI) {
  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = new MongoClient(MONGODB_URI).connect()
    }
    clientPromise = global._mongoClientPromise
  } else {
    clientPromise = new MongoClient(MONGODB_URI).connect()
  }
}

/** Returns a connected Db instance, or null if MONGODB_URI is not set. */
export async function getDb(): Promise<Db | null> {
  if (!clientPromise) return null
  const client = await clientPromise
  return client.db(MONGODB_DB)
}

export default clientPromise
