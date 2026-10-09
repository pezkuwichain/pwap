# Deploy keys and the scripts they are pinned to

CI reaches the hosts with four SSH keys, one per target. None of them opens a
shell. Each is pinned in `authorized_keys` to one script from this directory
(`restrict,command=`), so what CI can do on a host is exactly what that script
does, with the input it validates:

| target | host | user | key secret | forced command | input |
|---|---|---|---|---|---|
| app.pezkuwichain.io | NEW-7 `89.117.59.63` | `app-deploy` | `PWAP_APP_DEPLOY_KEY` | `pwap-web-receive app` | site tar on stdin |
| pex.mom | VPS3 `217.77.6.126` | `pex-deploy` | `PWAP_PEX_DEPLOY_KEY` | `pwap-web-receive pex` | site tar on stdin |
| indexer | NEW-7 `89.117.59.63` | `indexer-deploy` | `PWAP_INDEXER_DEPLOY_KEY` | `pwap-indexer-ssh` → sudo `pwap-indexer-deploy` | image SHA |
| Supabase | VPS3 `217.77.6.126` | `supabase-deploy` | `PWAP_SUPABASE_DEPLOY_KEY` | `pwap-supabase-ssh` → sudo `pwap-supabase-deploy` | bundle on stdin |

The hosts and their host keys are in the workflow env (`APP_HOST` …,
`DEPLOY_KNOWN_HOSTS`, the same lines as `ops/known_hosts`). A deploy to a host
that presents another key fails.

No key for these hosts belongs in root's `authorized_keys`.

## Installing on a host

Scripts are root-owned and not writable by the deploy users:

```sh
install -o root -g root -m 755 ops/host/pwap-web-receive /usr/local/sbin/
install -o root -g root -m 755 ops/host/pwap-indexer-ssh ops/host/pwap-indexer-deploy /usr/local/sbin/     # NEW-7
install -o root -g root -m 755 ops/host/pwap-supabase-ssh ops/host/pwap-supabase-deploy /usr/local/sbin/   # VPS3
```

Users (system accounts, no password):

```sh
useradd --system --create-home --shell /bin/bash app-deploy          # NEW-7
useradd --system --create-home --shell /bin/bash indexer-deploy      # NEW-7
useradd --system --create-home --shell /bin/bash supabase-deploy     # VPS3 (pex-deploy already exists)
```

Web roots belong to their deploy user, group `www-data`, setgid:

```sh
chown -R app-deploy:www-data /var/www/subdomains/app        # NEW-7
chmod -R g+rwX /var/www/subdomains/app
find /var/www/subdomains/app -type d -exec chmod g+s {} +
```

sudo, for the two deploys that have to run docker as root (`visudo -f`):

```
# /etc/sudoers.d/pwap-indexer-deploy (NEW-7)
indexer-deploy ALL=(root) NOPASSWD: /usr/local/sbin/pwap-indexer-deploy
# /etc/sudoers.d/pwap-supabase-deploy (VPS3)
supabase-deploy ALL=(root) NOPASSWD: /usr/local/sbin/pwap-supabase-deploy
```

The indexer's settings, `/etc/pwap-indexer.env` on NEW-7 (root, 644):

```
WS_ENDPOINT=wss://rpc.pezkuwichain.io
HOST_PORT=3011
```

`authorized_keys` of each deploy user, one line:

```
restrict,command="/usr/local/sbin/pwap-web-receive app" ssh-ed25519 AAAA... pwap-ci-app-deploy
```

## Checking it

`ops/host/test-web-receive.sh` runs the web script against a scratch web root,
including everything it must refuse; CI runs it with shellcheck in the
`workflow-guard` job. On a host, a key must fail anything but its command:

```sh
ssh -i key app-deploy@89.117.59.63 id      # refused: the only command is deploy
ssh -i key -N -L 1:127.0.0.1:22 app-deploy@89.117.59.63   # refused: restrict
```
