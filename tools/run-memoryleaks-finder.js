#!/usr/bin/env node
/*
Copyright by Oleg Efimov and node-mysql-libmysqlclient contributors
See contributors list in README

See license text in LICENSE file
*/

// Require modules
var
  sys = require("sys"),
  stdin,
  readline = require('readline'),
  rli,
  node_gc = require("./node-gc/gc");
  gc = new node_gc.GC(),
  mysql_libmysqlclient = require("../mysql-libmysqlclient"),
  mysql_bindings = require("../mysql_bindings"),
  cfg = require("./config").cfg;

var
  prompt = "mlf> ",
  buffered_cmd;

var
  initial_mu;

var
  commands = {
    quit: function () {
      process.exit(0);
    },
    show_memory_usage: function () {
      show_memory_usage();
    },
    gc: function () {
      gc.collect();
    },
    help: function () {
      stdin.write("List of commands:\n");
      for (var i in commands) {
        stdin.write(i + "\n");
      }
    },
    new_connection: function () {
      var conn = new mysql_bindings.MysqlConnection();
    },
    error_in_connect: function () {
      var
        conn = mysql_libmysqlclient.createConnectionSync(cfg.host, cfg.user, cfg.password, cfg.database_denied),
        error = conn.connectionError;
    },
    error_in_query: function () {
      var
        conn = mysql_libmysqlclient.createConnectionSync(cfg.host, cfg.user, cfg.password),
        error;
      
      conn.querySync("USE " + cfg.database_denied + ";");
      error = conn.errorSync();
    },
    fetch_all: function () {
      var
        conn = mysql_libmysqlclient.createConnectionSync(cfg.host, cfg.user, cfg.password, cfg.database),
        res,
        rows;
      
      res = conn.querySync("SELECT 'some string' as str;");
      rows = res.fetchAllSync();
      conn.closeSync();
    },
    fetch_all_and_free: function () {
      var
        conn = mysql_libmysqlclient.createConnectionSync(cfg.host, cfg.user, cfg.password, cfg.database),
        res,
        rows;
      
      res = conn.querySync("SELECT 'some string' as str;");
      rows = res.fetchAllSync();
      res.freeSync();
      conn.closeSync();
    },
    escape: function () {
      var
        conn = mysql_libmysqlclient.createConnectionSync(cfg.host, cfg.user, cfg.password, cfg.database),
        str;
      
      str = conn.escapeSync("some string");
      conn.closeSync();
    }
  }

function show_memory_usage_line(title, value0, value1) {
  if (value1) {
    stdin.write(title + ": " + value1 + (value1 > value0 ? " (+" : " (") + (100*(value1 - value0)/value0).toFixed(2) + "%)\n");
  } else {
    sys.puts(title + ": " + value0 + "\n");
  }
}

function show_memory_usage() {
  var mu;
  
  if (!initial_mu) {
    initial_mu = process.memoryUsage();
    
    sys.puts("Initial memory usage:");
    sys.puts("rss: " + initial_mu.rss);
    sys.puts("vsize: " + initial_mu.vsize);
    sys.puts("heapUsed: " + initial_mu.heapUsed);
  } else {
    mu = process.memoryUsage();
    
    stdin.write("Currect memory usage:\n");
    show_memory_usage_line("rss", initial_mu.rss, mu.rss);
    show_memory_usage_line("vsize", initial_mu.vsize, mu.vsize);
    show_memory_usage_line("heapUsed", initial_mu.heapUsed, mu.heapUsed);
  }
}

// Main program
sys.puts("Welcome to the memory leaks finder!");
sys.puts("Type 'help' for options.");
gc.collect();
show_memory_usage();

stdin = process.openStdin();
rli = readline.createInterface(stdin, function (text) {
  //return complete(text);
  var
    completions =[],
    completeOn;
  
  completeOn = text;
  for (var i in commands) {
    if (i.match(new RegExp("^" + text))) {
      completions.push(i);
    }
  }
  
  return [completions, completeOn];
});

rli.on("SIGINT", function () {
  rli.close();
});

rli.addListener('close', function () {
  show_memory_usage();
  stdin.destroy();
});

rli.addListener('line', function (cmd) {
  var flushed = true;

  var pair = cmd.trim().split(/\s+/);

  pair[0] = pair[0].trim();
  pair[1] = parseInt(pair[1]) > 0 ? parseInt(pair[1]) : 1;

  if (commands[pair[0]]) {
    try {
        for (var i = 0; i < pair[1]; i += 1) {
          commands[pair[0]].apply();
        }
    } catch (e) {
      stdin.write("Exception caused!\n");
      stdin.write(sys.inspect(e.stack) + "\n");
    }
    if (pair[0] != "help") {
      show_memory_usage();
    }
  } else if (pair[0] != "") {
    stdin.write("Unrecognized command: " + pair[0] + "\n");
    commands['help']();
  }

  rli.prompt();
});
stdin.addListener("data", function (chunk) {
  rli.write(chunk);
});
rli.setPrompt(prompt);
rli.prompt();
