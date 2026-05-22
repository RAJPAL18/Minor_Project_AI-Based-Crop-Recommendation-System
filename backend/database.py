from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from urllib.parse import quote_plus

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Determine database connection – use MySQL if credentials are provided, fallback to SQLite
MYSQL_USER = os.getenv('MYSQL_USER')
MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD')
MYSQL_HOST = os.getenv('MYSQL_HOST', 'localhost')
MYSQL_PORT = os.getenv('MYSQL_PORT', '3306')
MYSQL_DB = os.getenv('MYSQL_DB')

if MYSQL_USER and MYSQL_PASSWORD and MYSQL_HOST and MYSQL_DB:
    # URL-encode the password to handle special characters like '@'
    encoded_password = quote_plus(MYSQL_PASSWORD)
    mysql_url = (
        f"mysql+pymysql://{MYSQL_USER}:{encoded_password}"
        f"@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DB}"
    )
    print(f"[DB] Attempting MySQL connection: {MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DB}")
    try:
        # Create a temporary engine to test the connection (short timeout)
        temp_engine = create_engine(
            mysql_url,
            pool_pre_ping=True,
            pool_recycle=1800,
            connect_args={"connect_timeout": 3}
        )
        # Force connection test
        with temp_engine.connect() as conn:
            pass
        DATABASE_URL = mysql_url
        engine = temp_engine
        print("[DB] MySQL connection verified successfully.")
    except Exception as e:
        print(f"[WARNING] MySQL connection failed ({e}). Falling back to SQLite.")
        DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'kisanconnect.db')}"
        engine = create_engine(
            DATABASE_URL,
            connect_args={"check_same_thread": False}
        )
else:
    DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'kisanconnect.db')}"
    print("[DB] MySQL credentials not set — falling back to SQLite.")
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
