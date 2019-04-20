sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get install build-essential autoconf ffmpeg zlib1g-dev libssl-dev libpcre3-dev
mkdir data && cd data
git clone https://github.com/nginx/nginx
git clone https://github.com/arut/nginx-rtmp-mobule
cd nginx && ./auto/configure --add-module=../nginx-rtmp-module
sudo make install -j$(nproc)
sudo cp ../../nginx/nginx.conf /usr/local/nginx/conf/nginx.conf
sudo /usr/local/nginx/sbin/nginx
wget -qO- https://raw.githubusercontent.com/creationix/nvm/v0.34.0/install.sh | bash
export NVM_DIR="${XDG_CONFIG_HOME/:-$HOME/.}nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 11
cd ../../server
npm install
