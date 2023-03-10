FROM python:3.11.2-alpine

WORKDIR /app

COPY requirements.txt requirements.txt
RUN pip3 install -r requirements.txt
RUN apk add --no-cache openjdk17

COPY . .

EXPOSE 80
CMD [ "sanic", "main.app", "--host=0.0.0.0", "--port=80"]
