import pymysql
import os
from dotenv import load_dotenv

load_dotenv()

def create_database():
    host = os.getenv('MYSQL_HOST', 'localhost')
    user = os.getenv('MYSQL_USER', 'root')
    password = os.getenv('MYSQL_PASSWORD', '')
    port = int(os.getenv('MYSQL_PORT', '3306'))
    dbname = os.getenv('MYSQL_DB', 'kisanconnect')

    print(f"Attempting to connect to MySQL at {host}:{port} as {user}...")
    
    try:
        # Connect to MySQL without a database selected
        conn = pymysql.connect(
            host=host,
            user=user,
            password=password,
            port=port
        )
        
        with conn.cursor() as cursor:
            # Create database if it doesn't exist
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {dbname}")
            print(f"✅ Database '{dbname}' is ready.")
            
        conn.close()
    except Exception as e:
        print(f"❌ Error creating database: {e}")
        print("\nMake sure:")
        print(f"1. MySQL is running on {host}:{port}")
        print(f"2. Username '{user}' and password are correct in .env")
        print(f"3. User '{user}' has permission to create databases")

if __name__ == "__main__":
    create_database()
