ARG NODE_VERSION=22.14.0
FROM node:${NODE_VERSION}-alpine3.20

WORKDIR /app

# Copy only the selected server directory
COPY ./package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

ENTRYPOINT [ "npx" ]
