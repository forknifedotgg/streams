sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get install build-essential autoconf ffmpeg zlib1g-dev libssl-dev libpcre3-dev
mkdir data && cd data
git clone https://github.com/nginx/nginx
git clone https://github.com/arut/nginx-rtmp-mobule
cd nginx && ./auto/configure --add-module=/home/ubuntu/data/nginx-rtmp-module
sudo make install -j$(nproc)
sudo cp ../nginx/nginx.conf /usr/local/nginx/conf/nginx.conf

