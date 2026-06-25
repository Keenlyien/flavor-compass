from pymongo import MongoClient
from dotenv import load_dotenv
from pathlib import Path
import os
import certifi

load_dotenv(Path('D:/projects/digital_chef/.env.local'))
client = MongoClient(os.environ['MONGODB_URI'], tlsCAFile=certifi.where())
db = client[os.environ.get('MONGODB_DB', 'digital_chef')]
col = db['recipes']
print('Total recipes:', col.count_documents({}))
client.close()
