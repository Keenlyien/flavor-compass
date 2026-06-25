from pymongo import MongoClient
from dotenv import load_dotenv
from pathlib import Path
import os
import certifi

load_dotenv(Path('D:/projects/digital_chef/.env.local'))

uri = os.environ.get('MONGODB_URI', '')
db_name = os.environ.get('MONGODB_DB', 'digital_chef')

print(f"Connecting to: {uri[:30]}...")
print(f"Database: {db_name}")

client = MongoClient(uri, tlsCAFile=certifi.where())
client[db_name]['ingredient_images'].drop()
print('Cleared.')
client.close()