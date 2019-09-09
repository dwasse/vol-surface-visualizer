sudo apt-get update
sudo apt-get -y install postgresql
sudo apt-get -y install python-psycopg2
sudo apt-get -y install libpq-dev
sudo apt-get -y install python3-pip
pip3 install -r requirements.txt
service postgresql start
