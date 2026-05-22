import pymysql

def setup():
    conn = pymysql.connect(host='localhost', port=3306, user='root', password='')
    cursor = conn.cursor()
    cursor.execute('CREATE DATABASE IF NOT EXISTS kisan_db;')
    
    # Try to create user, catch if exists
    try:
        cursor.execute("CREATE USER 'kisanadmin'@'localhost' IDENTIFIED BY 'Kisan@2026';")
    except pymysql.err.OperationalError as e:
        if 'Operation CREATE USER failed' in str(e):
            print("User already exists. Updating password.")
            cursor.execute("ALTER USER 'kisanadmin'@'localhost' IDENTIFIED BY 'Kisan@2026';")
        else:
            raise e
            
    cursor.execute("GRANT ALL PRIVILEGES ON kisan_db.* TO 'kisanadmin'@'localhost';")
    cursor.execute('FLUSH PRIVILEGES;')
    conn.commit()
    print('Database and user created successfully.')
    conn.close()

if __name__ == "__main__":
    setup()
