var g = {"graph":{"name":"Hello World"}, 
 "nodes":[
  {"id":"n0","name":"selector","io":{"selector":"#Pin1"}},
  {"id":"n1","name":"concat","process":["this.greeting = salutation + ' ' + name;"]},
  {"id":"n2","name":"","data":{"salutation":"Hello"}},
  {"id":"n3","name":"selector","io":{"selector":"console"}},
  {"id":"n4","name":"name","data":{"name":"World"}},
  {"id":"n5","name":"end","data":{"value":true}},
  {"id":"n6","name":"selector","io":{"selector":"#Pin1"}}
 ],
 "edges":[
  ["n0","n1","sub","low","",0],
  ["n1","n2","get","salutation","",1],
  ["n1","n4","get","name","",2],
  ["n1","n3","set","greeting","",3],
  ["n5","n6","set","","",4],
  ["n1","n5","flo","next","",5]
 ]
};

// graphlet query
//
var graphlet = {};
var gq = {
  "using": function(g) {
    graphlet = g;
	return this;
  },
  "find": function(sel) {
    var res = {};
    if (sel.element === "node") {
      res.nodes = [];
      g.nodes.forEach(function(o) {
        if (sel.id && sel.id === o.id) {
          res.nodes.push(o);
        }
        if (sel.type && o[sel.type]) {
          res.nodes.push(o);
        }
      });
    }
    else if (sel.element === "edge") {
      res.edges = [];
      g.edges.forEach(function( o) {
        if ((!sel.type || sel.type === 'all' || o[2] === sel.type) &&
            (!sel.from || o[0] === sel.from) &&
            (!sel.to || o[1] === sel.to)
           ) {
          console.log(o[2]);
          res.edges.push(o);
        }
      });
    }
    graphlet = res;
    return this;
  },
  "edges": function() {
    return graphlet.edges;
  },
  "nodes": function() {
    return graphlet.nodes;
  },
  "graph": function() {
    return graphlet;
  }
};



var get_all = function(id) {
  var got_obj = {};
  var g = this.glt;
  var get_edges = gq.using(g).find({"element":"edge", "type":"get", "from":id}).edges();
  get_edges.forEach(function(e) {
    var to_node_id = e[1];
    var end_node = gq.using(g).find({"element":"node", "id":to_node_id}).nodes()[0];
    var name = e[3] || end_node.name;
    var alias = e[4] || name;
    var this_edge;
    var this_node;
    var selector;
    if (debug_rate) {
      vis_run_state("edge[source='"+e[0]+"'][target='"+e[1]+"'][edge_type='get']", "active_run_get", debug_rate/2);
    }
    if (end_node.io) {
      if (end_node.io.selector && end_node.io.valve >= 2) {
        selector = end_node.io.selector;
        if (!end_node.data) {end_node.data = {};}
        //end_node.data[name] = $(selector).val() || $(selector).text();
        if (end_node.io.as_type && typeof end_node.data[name] != end_node.io.as_type) {
          console.log("convert type "+typeof end_node.data[name] +" to "+end_node.io.as_type);
          if (end_node.io.as_type === "boolean") {
            end_node.data[name] = (end_node.data[name] === 'true' || end_node.data[name] === '1' || end_node.data[name] === 'on');
          }
        }
      }
      else {
        console.log("Warning: io node was not able to provide data to get edge. ", JSON.stringify(end_node.io));
      }
    }
    if (end_node.data) {
      got_obj[alias] = end_node.data[name];
      if (debug_rate) {
        vis_run_state("node[id='"+end_node.id+"']", "active_run_get", debug_rate/2);
      }
    }
  });
  return got_obj;
};

var set_all = function(id, result) {
  var g = this.glt;
  var set_edges = gq.using(g).find({"element":"edge", "type":"set", "from":id}).edges();
  var pub_edges = gq.using(g).find({"element":"edge", "type":"pub", "from":id}).edges();
  set_edges.forEach(function(e) {
    var end_node = gq.using(g).find({"element":"node", "id":e[1]}).nodes()[0];
    var start_node = gq.using(g).find({"element":"node", "id":id}).nodes()[0];
    var alias = e[3];
    var name = alias || end_node.name || start_node.name || "data";
    var this_edge;
    var cy_target_node;
    var guard_expression = e[4];
    var guard = {"result":true};

    if (guard_expression) {
      guard = run_edge_guard(result, guard_expression);
    }

    if (debug_rate && guard.result) {
      vis_run_state("edge[source='"+e[0]+"'][target='"+e[1]+"'][edge_type='set']", "active_run_set", debug_rate/2);
    }
    if (guard.result) {
      if (end_node.io && end_node.io.selector) {
        //set io pin


      }
      if (!end_node.data) { end_node.data = {};}
      end_node.data[name] = result[name];
      if (end_node.io && end_node.io.selector) {
        //$(end_node.io.selector).text(end_node.data[name]);
        //$(end_node.io.selector).val(end_node.data[name]);
      }
      set_all(e[1], result);
      if (debug_rate) {
        vis_run_state("node[id='"+end_node.id+"']", "active_run_set", debug_rate/2);
      }
    }
  });
  pub_edges.forEach(function(e) {
    var end_node = gq.using(g).find({"element":"node", "id":e[1]}).nodes()[0];
    var start_node = gq.using(g).find({"element":"node", "id":id}).nodes()[0];
    var effect_options;
    if (start_node.data && start_node.data.effect && end_node.io && end_node.io.selector) {
      effect_options = $.extend({"complete":function() {
        console.log("effect complete"); //this.data['effect state'] = "done"
      }}, start_node.data);
      $(end_node.io.selector).effect(effect_options);
    }
    else {
      console.log("trigger of " + e[2]);
      $('body').trigger(e[2]);
    }

  });
};

var transition_to = function(id, get_result) {
  var gone = false;
  var g = this.glt;
  var trans_edges = gq.using(g).find({"element":"edge", "type":"flo", "from":id}).edges();
  // first go through only the restrictive guarded flo edges.
  trans_edges.forEach(function(e) {
    var guard_expression = e[4];
    var guard = {"result":false};
    if (guard_expression && !gone) {
      guard = run_edge_guard(get_result, guard_expression);

      if (guard.result) {
        console.log("trigger transition "+e[0]+" -> "+e[1]);
        if (debug_rate) {
          vis_run_state("edge[source='"+e[0]+"'][target='"+e[1]+"'][edge_type='flo']", "active_run_flo", debug_rate);
        }
        setTimeout(function() {hb_trigger("edge_" + e[5]);}, debug_rate);
        gone = true;
      }
    }
  });
  // secondly go to any non-restrictive flo edges (with no guard)
  trans_edges.forEach(function(e) {
    var guard_expression = e[4];
    var guard = {"result":true};
    if (!guard_expression & !gone) {
      if (guard.result) {
        console.log("trigger transition "+e[0]+" -> "+e[1]);
        if (debug_rate) {
          vis_run_state("edge[source='"+e[0]+"'][target='"+e[1]+"'][edge_type='flo']", "active_run_flo", debug_rate);
        }
        setTimeout(function() {hb_trigger("edge_" + e[5]);}, debug_rate);
      }
    }
  });
};

var run_node = function(target_node) {
  var get_data = get_all(target_node.id);
  var this_node;
  var wait = function(milliseconds) {
    console.log("wait() defers transition at node "+target_node.id+" by "+milliseconds);
    get_data.defered_transition = true;
    setTimeout(function() {transition_to(target_node.id, {});}, milliseconds);
  };
  if (debug_rate) {
    vis_run_state("node[id='"+target_node.id+"']", "active_run_node", debug_rate);
  }
  get_data.defered_transition = false;
  if (target_node.data) {
    get_data = $.extend(get_data, target_node.data);
  }
  if (target_node.process) {
    get_data.wait = wait;
    get_data.target_node_id = target_node.id;
    target_node.process.forEach(function(process) {
      get_data = run_node_process(get_data, process);
    });
  }

  setTimeout(function() {
    set_all(target_node.id, get_data);
    if (!get_data.defered_transition) {
      transition_to(target_node.id, get_data);
    }
  }, debug_rate/2);
};

// sandbox for functional (saferEval)
// create our own local versions of window and document with limited functionality
var run_node_process = function (env, code) {
  return env;
};

var run_edge_guard = function (env, code) {
  var result = {};
  return result;
};

init_graphlet = function(g) {
  var io_nodes = gq.using(g).find({"element":"node", "type":"io"}).nodes();
  var flo_edges = gq.using(g).find({"element":"edge", "type":"flo"}).edges();
  var subscribe_edges = gq.using(g).find({"element":"edge", "type":"sub"}).edges();
  this.glt = g;
  // cancel any previous listeners for a graph_init message.
  hb_off('graph_init');
  debug_rate = 0;
  if (g.graph && g.graph.template) {
    //// set up env
    //$(function() {
    //	$("#graphlet").html(g.graph.template);
    //});
  }
  io_nodes.forEach(function(node) {
    var selector, selector_str;
    var sel_dom;
    if (node.io && node.io.selector) {
      selector = node.io.selector;
      // initial sync the nodes data with the IO point
    }
  });
  flo_edges.forEach(function(e) {
    hb_off("edge_" + e[5]);
    hb_on("edge_" + e[5], function () {
      var to_node_id = e[1];
      var target_node = gq.using(g).find({"element":"node", "id":to_node_id}).nodes()[0];
      run_node(target_node);
    });
  });
  // first time to turn off all listeners
  subscribe_edges.forEach(function(i, e) {
    if (e) {
      var from_node_id = e[0];
      var event_name = e[3];
      var source_node = gq.using(g).find({"element":"node", "id":from_node_id}).nodes()[0];
      var io = source_node.io;
      if (!io) {io = {};}
      if (!io.selector) {io.selector = 'body';}
      hb_off(event_name);
    }
  });
  // secontime through this set of edges to turn on listneing (subscribe) to events.
  subscribe_edges.forEach(function(i, e) {
    if (e) {
      var from_node_id = e[0];
      var event_name = e[3];
      var source_node = gq.using(g).find({"element":"node", "id":from_node_id}).nodes()[0];
      var io = source_node.io;
      if (!io) {io = {};}
      if (!io.selector) {io.selector = 'body';}
      hb_on(event_name, function() {
        var to_node_id = e[1];
        var target_node = gq.using(g).find({"element":"node", "id":to_node_id}).nodes()[0];
        run_node(target_node);
      });
    }
  });
  console.log("trigger of graph_init event");
  hb_trigger('graph_init');
};


function vis_run_state(s, msg, delay) {console.log(s, msg, delay);}
function hb_trigger(evt) {console.log(evt);}
function hb_on(evt, func) {console.log(evt);}
function hb_off(evt) {console.log(evt);}


