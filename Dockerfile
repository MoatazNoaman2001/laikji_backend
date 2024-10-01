FROM node:lts-alpine as build

WORKDIR /

RUN yarn install 

COPY . .

EXPOSE 3000 

CMD [ 'nodemon', 'app.js' ]