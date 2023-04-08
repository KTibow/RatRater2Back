# rat-to-peer

This is what lets RatRater 2 quickly open a file from an external source. Why? Well, what did I consider before?

- cloudflare worker: discord cdn blocked cloudflare
- cloudflare databases (temporarily store): all their options require signing up
- another web host or database host: i dont want to sign up for another hosting service

## using the server

First, connect to the server. Then send a message in JSON format. Each message will be replied to by the server.

- Message: `type: get-file, hash: [hash]`  
  Reply: `type: success, data: [file data], name: [name]`
- Message: `type: upload-file, key: [api key], data: [file data], name: [name]`  
  Reply: `type: success, hash: [hash]`

If you don't get it:

1. check the server code (here)
2. check the downloader code (ratrater2: `lib/files/FileAltInputs.svelte`)
3. see the uploader example:

```js
const ws = new WebSocket("wss://rat-to-peer.onrender.com");
ws.addEventListener("message", (m) => console.log(m.data));
const fileb64 = "file as base 64 goes here";
ws.send(
  JSON.stringify({
    type: "upload-file",
    key: "key goes here",
    data: atob(fileb64), // upload the file's raw data as a string - this part can be tricky
    name: "test.jar",
  })
);
```
