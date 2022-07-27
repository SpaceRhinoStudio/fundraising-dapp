FROM node:16-alpine
RUN apk add --no-cache python3 g++ make git npm
# node gyp requires python
RUN python3 -m ensurepip
RUN pip3 install --no-cache --upgrade pip setuptools
WORKDIR /app
COPY . .
RUN yarn install
# to ensure compiler download
RUN npx hardhat compile
ENTRYPOINT ["/usr/local/bin/npm", "run"]
