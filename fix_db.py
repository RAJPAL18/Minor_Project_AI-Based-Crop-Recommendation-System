import pymysql

def setup():
    conn = pymysql.connect(host='localhost', port=3306, user='root', password='')
    cursor = conn.cursor()
    
    # Check databases
    cursor.execute('SHOW DATABASES;')
    print(cursor.fetchall())
    
    # Try to grant everything
    try:
        cursor.execute("GRANT ALL PRIVILEGES ON kisan_db.* TO 'kisanadmin'@'localhost';")
        cursor.execute("FLUSH PRIVILEGES;")
    except Exception as e:
        print("Error granting:", e)
        
    conn.commit()
    print('Permissions granted successfully.')
    conn.close()

if __name__ == "__main__":
    setup()
