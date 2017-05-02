# nba
NBA!

- Should I watch?
- Switch to Angular
- Handle games that haven't finished
- Make it pretty
- Keyboard bindings
- Ads
- Make sure cache doesn't grow too large? maybe not
- Use https
- revalidate caches (304, if-modified-since etc)

- This command gives per quarter info, for games that are in progress as well as for games that are finished:
```
// curl -v http://data.nba.net/data/10s/prod/v1/20170131/0021600727_pbp_3.json | json_pp
```

check here for stats docs:

https://github.com/seemethere/nba_py/wiki/stats.nba.com-Endpoint-Documentation


server setup:

# enable nodejs to listen on ports < 1024 without being root. Less
# nasty than running the whole webserver with elevated privileges

sudo setcap 'cap_net_bind_service=+ep' /usr/bin/nodejs

# make sure timezone is correct, otherwise we get problems with lists
# of games. Should maybe be fixed to account for users' timezones in
# the webpage

sudo dpkg-reconfigure tzdata

should switch to http://data.nba.net/data/10s/prod/v1/2016/players.json