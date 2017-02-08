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