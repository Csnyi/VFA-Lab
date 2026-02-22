# VFA-Lab
mini “zárt lab” docker-compose

Ami:
- Client → Policy Gateway (L3.5) → Merchant API
- VFA token nélkül → sandbox (vagy limited)
- VFA tokennel → prod (merchant)
- Revokáció → azonnal visszavált sandboxra / deny

---

Mappastruktúra:
```
vfa-lab/
	data/
		placeholder
	docs
		images/
			demo.png
	gateway/
		client/
			index.html
		Dockerfile
		package.json
		policy.js
		revocations.json
		server.js
	merchant/
		app.py
		Dockerfile
	sandbox/
		app.py
		Dockerfile
```
---
A gateway dönt és proxy-z:
- GET /healthz
- POST /issue -> ad egy token-t (lab kényelmi)
- POST /revoke -> revokál token_id-t (tokenből vagy explicit)
- ANY /api/* -> policy döntés után merchant vagy sandbox

Futatás  
A vfa-lab/ mappában:

```Bash
docker compose up --build
```

Gateway kint lesz: http://localhost:8080

Demo parancsok (3 perces “wow”)

1) Token nélkül → sandbox
```Bash
curl -s http://localhost:8080/api/hello | jq
curl -s http://localhost:8080/api/data | jq
```
2) Token igénylés
```Bash
TOKEN=$(curl -s -X POST http://localhost:8080/issue | jq -r .visaToken)
echo "$TOKEN"
```
3) Token-nel → merchant (prod)
```Bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/hello | jq
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/data | jq
```
4) Revokáció → azonnal vissza sandbox
```Bash
curl -s -X POST http://localhost:8080/revoke -H "Content-Type: application/json" \
  -d "{\"visaToken\":\"$TOKEN\"}" | jq

curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/hello | jq
```
Extra: élő policy log   
A gateway logban látod:
- decision: prod|sandbox|deny
- reason: ok|missing_token|expired|revoked|bad_sig

Ha még látványosabb: packet capture (opcionális)   
Linux hoston (nem kötelező):
```Bash
sudo tcpdump -ni any port 8080
```
Docker parancsok
```
sudo usermod -aG docker $USER \
newgrp docker \
docker compose ps \ 
docker compose up -d --build
docker compose ps
docker compose down
```
