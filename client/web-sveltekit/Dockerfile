# This image creates a standalone web server for demoing the prototype
FROM node:16@sha256:d70de5be007866473408af5cc39f6039d990d8d4f72ae13438b0b4f83b904b31

ARG PROJECT_ROOT="."

WORKDIR /usr/src/app
RUN echo '{"type": "module"}' > package.json
RUN npm install express@~4.18 http-proxy-middleware@~2.0
COPY  ${PROJECT_ROOT}/server.js ./
COPY ${PROJECT_ROOT}/build ./build

ENV SOURCEGRAPH_API_HOST=https://sourcegraph.com
EXPOSE 4173
CMD ["node", "server.js"]
