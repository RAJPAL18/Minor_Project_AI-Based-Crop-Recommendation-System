import pymysql

def setup():
    conn = pymysql.connect(host='localhost', port=3306, user='root', password='')
    cursor = conn.cursor()
    cursor.execute("GRANT ALL PRIVILEGES ON *.* TO 'kisanadmin'@'localhost' WITH GRANT OPTION;")
    cursor.execute('FLUSH PRIVILEGES;')
    conn.commit()
    print('Permissions granted globally.')
    conn.close()

if __name__ == "__main__":
    setup()
