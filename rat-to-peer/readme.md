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

See the code for the different error types and information about API keys.
