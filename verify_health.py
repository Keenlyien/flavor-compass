from pymongo import MongoClient
from dotenv import load_dotenv
from pathlib import Path
import os
import certifi

load_dotenv(Path('D:/projects/digital_chef/.env.local'))
client = MongoClient(os.environ['MONGODB_URI'], tlsCAFile=certifi.where())
col = client[os.environ.get('MONGODB_DB', 'digital_chef')]['recipes']

print("Total recipes:", col.count_documents({}))
print("With healthScore:", col.count_documents({"healthScore": {"$exists": True}}))
print("With cuisines array:", col.count_documents({"cuisines": {"$exists": True}}))
print("With diets:", col.count_documents({"diets": {"$exists": True}}))

print("\nTop 5 healthiest:")
for doc in col.find({"healthScore": {"$exists": True}}).sort("healthScore", -1).limit(5):
    print(f"  {doc.get('healthScore')}  {doc.get('title')}")

print("\nBottom 5 (least healthy):")
for doc in col.find({"healthScore": {"$exists": True}}).sort("healthScore", 1).limit(5):
    print(f"  {doc.get('healthScore')}  {doc.get('title')}")

client.close()
