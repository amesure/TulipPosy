/************************************************************************
 * This class is the core of our visualization system. It manages both
 * the visualization through svg objects and communication with the
 * tulip python server. It displays 2 graphs, one corresponding to the
 * substrate graph and the other to the catalyst graph, and manages the
 * interactions between them. 
 * @requires d3.js, jQuery, graph.js, lasso.js
 * @authors Benjamin Renoust, Guy Melancon
 * @created May 2012
 ***********************************************************************/

// This class must be called like any function passing the well formated JSON object.
// originalJSON: a json object with an acceptable format
//
// We need to document the acceptable JSON format, and the communication protocol with
// tulip. This class also might be divided into classes, at least one should deal only
// with the communication, the other with the interaction, another for the overall
// interface...
var TulipPosy = function(originalJSON)
{ 

        // initialization of the communication address and port        
        // an additional default json file
        var tulip_address = "http://localhost:8085";
        var json_address = "./cluster1.json";

        // initialization of the default svg parameters
        var width = 960;
        var height = 500;
         
        // initialization of the svg frames
        var svg_substrate = d3.select("body").append("svg")
            .attr("width", width)
            .attr("height", height)
            .attr("id", "svg_substrate");
        var svg_catalyst = d3.select("body").append("svg")
            .attr("width", width)
            .attr("height", height)
            .attr("id", "svg_catalyst");
        
        // initialization of the graphs, and lasso interactors
        var graph_substrate = new graph();
        var graph_catalyst = new graph();
        var lasso_catalyst = null;
        var lasso_substrate = null;

        // initialization of the selection and move modes
        var select_mode_substrate = false;
        var move_mode_substrate = true;
        var show_labels_substrate = true;
        var show_links_substrate = true;
        var node_information_substrate = false;
        var select_mode_catalyst = false;
        var move_mode_catalyst = true;
        var show_labels_catalyst = true;
        var show_links_catalyst = true;
        var node_information_catalyst = false;
        var mouse_over_button = false;
        
        // initialization of the global entanglement parameters
        var catalyst_sync_operator = "AND";
        var entanglement_intensity = 0.0;
        var entanglement_homogeneity = 0.0;

        // initialization of default interface visual parameters
        var defaultFillColor = "white";
        var highlightFillColor = "lavender";
        var defaultTextColor = "black";
        var defaultBorderColor = "gray";
        var defaultBorderWidth = .5;
        var defaultTextFont = "Arial";        
        var defaultTextSize = 14;
        //var color = d3.scale.category20();

        var sessionSid = 0;
        

        
        // This method returns the nodes that are selected in a given graph.
        // graphName, the string value corresponding to the graph we want to select nodes in ('substrate' or 'catalyst')
        // After selected all 'g.node' of class 'selected', the function constructs and array of nodes with only its 'baseID'
        // and returns a string JSON version of the corresponding selection
        var getSelection = function(graphName)
        {
                var cGraph = null;
                var svg = null;

                if (graphName == 'substrate')
                {        
                        cGraph = graph_substrate;
                        svg = svg_substrate;
                }

                if (graphName == 'catalyst')
                {        
                        cGraph = graph_catalyst;
                        svg = svg_catalyst;
                }


                //console.log("GETSELECTION: The node selection= ", svg.selectAll("g.node.selected"));
                var u = svg.selectAll("g.node.selected").data();

                var toStringify = {};
                toStringify.nodes = new Array();

                for (i=0; i<u.length; i++)
                {
                        var node = {};
                        node.baseID = u[i].baseID;
                        //console.log(u[i]);
                        toStringify.nodes.push(node);
                }
                //console.log(JSON.stringify(toStringify));
                return JSON.stringify(toStringify);
        };


        // This function send to the tulip server a selection of nodes and removes the unselected nodes
        // json, the json string of the graph
        // graphName, the string value corresponding to the graph
        var sendSelection = function(json, graphName)
        {
                console.log("calling sendselection: ",graphName," ",json);
                var cGraph = null;
                var svg = null;

                if (graphName == 'substrate')
                {        
                        cGraph = graph_substrate;
                        svg = svg_substrate;
                }

                if (graphName == 'catalyst')
                {        
                        cGraph = graph_catalyst;
                        svg = svg_catalyst;
                }

                $.post(tulip_address, { sid:sessionSid, type:"update", graph:json, target:graphName }, function(data){
                        data = JSON.parse(data)
                        console.log("querying an induced subgraph:",graphName," ",json);
                        cGraph.nodes(data.nodes);
                        cGraph.links(data.links);
                        cGraph.edgeBinding();
                        var graph_drawing = graphDrawing(cGraph, svg);
                        graph_drawing.exit(cGraph, 0);
                });

        };



        // This function calls a layout algorithm of a graph through tulip, and moves the given graph accordingly
        // layoutName, the name of the tulip layout we want to call
        // graphName, the string value corresponding to the graph
        var callLayout = function(layoutName, graphName)
        {

                var params = {type:"layout", name:layoutName, target:graphName};
                //console.log('going to send params as: ', params)
                
                var cGraph = null;
                var svg = null;

                if (graphName == 'substrate')
                {        
                        cGraph = graph_substrate;
                        svg = svg_substrate;
                }

                if (graphName == 'catalyst')
                {        
                        cGraph = graph_catalyst;
                        svg = svg_catalyst;
                }

                $.post(tulip_address, {sid:sessionSid, type:'algorithm', parameters:JSON.stringify(params)}, function(data){
                        // we need to rescale the graph so it will fit the current svg frame and not overlap the buttons
                        data = JSON.parse(data)
                        rescaleGraph(data);
                        cGraph.nodes(data.nodes);
                        cGraph.links(data.links);
                        cGraph.edgeBinding();
                        var graph_drawing = graphDrawing(cGraph, svg);
                        graph_drawing.move(cGraph, 0);
                });
        };



        // This function calls a float algorithm of a graph through tulip, and moves the given graph accordingly
        // floatAlgorithmName, the name of the tulip algorithm we want to call
        // graphName, the string value corresponding to the graph
        var callFloatAlgorithm = function(floatAlgorithmName, graphName)
        {

                var params = {type:"float", name:floatAlgorithmName, target:graphName};

                var cGraph = null;
                var svg = null;

                if (graphName == 'substrate')
                {        
                        cGraph = graph_substrate;
                        svg = svg_substrate;
                }

                if (graphName == 'catalyst')
                {        
                        cGraph = graph_catalyst;
                        svg = svg_catalyst;
                }
        

                $.post(tulip_address, {sid:sessionSid, type:'algorithm', parameters:JSON.stringify(params)}, function(data){
                        data = JSON.parse(data)
                        rescaleGraph(data);
                        cGraph.nodes(data.nodes);
                        cGraph.links(data.links);
                        cGraph.edgeBinding();
                        var graph_drawing = graphDrawing(cGraph, svg);
                        graph_drawing.resize(cGraph, 0);

                        addInterfaceSubstrate();
                        addInterfaceCatalyst();
                        entanglementCaught();


                });
        };



        // This function adds the baseID property for data which is the basic identifier for all nodes and links
        // data, the data to update
        // idName, if given, the property value of 'idName' will be assigned to 'baseID'
        var addBaseID = function(data, idName)
        {
                console.log(data)
                data.nodes.forEach(function(d){//d.currentX = d.x; d.currentY = d.y;})
                                               if ("x" in d){d.currentX = d.x;}else{d.x = 0; d.currentX = 0;};
                                               if ("y" in d){d.currentY = d.y;}else{d.y = 0; d.currentY = 0;};})
                if (idName == "")
                {
                        data.nodes.forEach(function(d, i){d.baseID = i});
                        data.links.forEach(function(d, i){d.baseID = i});
                }
                else
                {
                        data.nodes.forEach(function(d, i){d.baseID = d[idName]});
                        data.links.forEach(function(d, i){d.baseID = d[idName]});
                }
        }


        // This function loads a substrate graph from a given json
        // data, the data to load
        //
        // we might want to rename this function...        
        var loadJSON = function(data)
        {
                rescaleGraph(data)
                console.log("the data to store:", data);
                graph_substrate.nodes(data.nodes)
                graph_substrate.links(data.links)
                graph_substrate.edgeBinding()
                console.log("loading JSON", graph_substrate.nodes(), graph_catalyst.nodes())

                var graph_drawing = graphDrawing(graph_substrate, svg_substrate)
                graph_drawing.draw()
                
                return
        }
        
        // This function calls the synchronization from a given graph through tulip, returns and applies
        // the result on the other graph. The computed entanglement indices are also updated.
        // selection, the JSON string of the selected subgraph
        // graphName, the graph origin of the selection
        var syncGraph = function(selection, graphName)
        {
                console.log('sending a synchronization request: ', selection)

                var cGraph = null
                var svg = null

                if (graphName == 'substrate')
                {        
                        cGraph = graph_catalyst
                        svg = svg_catalyst
                }

                if (graphName == 'catalyst')
                {        
                        console.log('target is catalyst');
                        cGraph = graph_substrate
                        console.log(selection)
                        svg = svg_substrate
                }

        

                $.post(tulip_address, {sid:sessionSid, type:'analyse', graph:selection, target:graphName, operator:catalyst_sync_operator}, function(data){
                        
                        data = JSON.parse(data)
                        //var oldData = cGraph.nodes();
                        //var selectedID = [];
                        //var selectedNodes = [];
                        //data.nodes.forEach(function(d){selectedID.push(d.baseID);});
                        //console.log("selectedIDs",selectedID);
                        //console.log('cGraph',graphName, cGraph.nodes())
                        //cGraph.nodes().forEach(function(d){if(selectedID.indexOf(d.baseID) > -1) selectedNodes.push(d);});
                        //console.log("Selected Nodes:", selectedNodes);

                        console.log("received data after synchronization: ")
                        console.log(data);
                        //convertLinks(data);
                        //rescaleGraph(data)
                        
                        var tempGraph = new graph()
                        tempGraph.nodes(data.nodes)
                        tempGraph.links(data.links)

                        tempGraph.edgeBinding()

                        //cGraph.nodes(data.nodes)
                        //cGraph.links(data.links)

                        //cGraph.edgeBinding()
                        
                        var graph_drawing = graphDrawing(cGraph, svg)
                        
                        //g.clear()
                        //g.draw()
                        graph_drawing.show(tempGraph)
                        if ('data' in data)
                        {
                                entanglement_homogeneity = data['data']['entanglement homogeneity'];
                                entanglement_intensity = data['data']['entanglement intensity'];
                                entanglementCaught();
                        }
                });

        }


        // This function calls through tulip the analysis of a substrate graph, stores and displays it
        // in the catalyst view, updating the new entanglement indices computed.
        var analyseGraph = function()
        {
                  var params = {type:"analyse"}
                //console.log("starting analysis:",graph_catalyst.nodes(), graph_substrate.nodes())

                var truc = 15;
                truc = sessionSid;

                $.post(tulip_address, {sid:truc, type:'analyse', target:'substrate'}, function(data){
                        data = JSON.parse(data)
                        console.log("received data after analysis:")
                        console.log(data);
                        //convertLinks(data);
                        rescaleGraph(data)
                        //console.log("right before:",graph_catalyst.nodes(), graph_substrate.nodes())
                        graph_catalyst.nodes(data.nodes)

                        //console.log("loaded graph:",graph_catalyst.nodes(), graph_substrate.nodes())

                        graph_catalyst.links(data.links)
                        graph_catalyst.edgeBinding()
                        graph_drawing = graphDrawing(graph_catalyst, svg_catalyst)
                        graph_drawing.clear()
                        graph_drawing.draw()
                        entanglement_homogeneity = data['data']['entanglement homogeneity']
                        entanglement_intensity = data['data']['entanglement intensity']
                        //console.log("after analysis:",graph_catalyst.nodes(), graph_substrate.nodes())
                        entanglementCaught();
                });

        }



        // This function creates a new substrate graph in tulip, initializes, returns and displays it.
        // json, the initial json string corresponding to the graph.
        var createTulipGraph = function(json)
        {
                $.ajax({url:tulip_address, data:{type:"creation", graph:json}, type:'POST', async:false, success:function(data){
                        console.log('creating in tulip, and recieved data: ',data)
                        data = JSON.parse(data)
                        console.log("here should be sid: ", data.data.sid)
                        sessionSid = data.data.sid
                        console.log("the session sid has just been affected: ",sessionSid);
                        rescaleGraph(data)
                        graph_substrate.nodes(data.nodes)
                        graph_substrate.links(data.links)
                        graph_substrate.edgeBinding()
                        graph_drawing = graphDrawing(graph_substrate, svg_substrate)
                        graph_drawing.move(graph_substrate, 0)
                }});
        }


        // This function calls a special case of creation of a graph, instead of passing a json graph
        // object, it passes a query that goes through a search engine to build then a substrate graph.
        // query, the query to pass to the search engine
        var callSearchQuery = function(query)
        {
                var recieved_data;
                console.log('calling search query ', query)
                $.ajax({url:tulip_address, async:false, data:{ type:"creation", 'search':query['query'] }, type:'POST', 
                        success:function(data){
                                console.log('sending search request in tulip, and recieved data: ',data)
                                data = JSON.parse(data)
                                recieved_data = data
                        }
                });
                return JSON.stringify(recieved_data)
                /*
                $.post(tulip_address, { type:"creation", 'search':query['query'] }, function(data){
                        console.log('sending search request in tulip, and recieved data: ',data)
                        return JSON.stringify(data)
                });*/
        }


        // This function rescales the graph data in order to fit the svg window
        // data, the graph data (modified during the function)
        var rescaleGraph = function(data)
        {

                console.log("should be rescaling graphe, here is the data: ", data);

                // these should be set as globale variables
                var buttonWidth = 130.0
                var frame = 10.0
                var w = width-(buttonWidth+2*frame)
                var h = height-(2*frame)
                if (data.nodes.length<=0) return
                
                var minX = data.nodes[0].x
                var maxX = data.nodes[0].x
                var minY = data.nodes[0].y
                var maxY = data.nodes[0].y

        
                data.nodes.forEach(function(d){if (d.x < minX){minX = d.x}; if (d.x > maxX){maxX = d.x}; if (d.y < minY){minY = d.y}; if (d.y > maxY){maxY = d.y};})
        
                //data.nodes.forEach(function(d){console.log("Point: ",d.x,' ', d.y)})

                var delta = 0.00000000000000000001 //to avoid division by 0
                scale = Math.min.apply(null, [w/(maxX-minX+delta), h/(maxY-minY+delta)])
        
                data.nodes.forEach(function(d){d.x = (d.x-minX)*scale+buttonWidth+frame; d.y = (d.y-minY)*scale+frame; d.currentX = d.x; d.currentY = d.y;})
        }

        var addInfoBox = function(target, node)
        {
                var cGraph = null
                var svg = null

                if (target == 'substrate')
                {        
                        cGraph = graph_substrate
                        svg = svg_substrate
                }

                if (target == 'catalyst')
                {        
                        cGraph = graph_catalyst
                        svg = svg_catalyst
                }

                
                function move(){
                    //var e = window.event;
                    //if (e.ctrlKey || e.metaKey) return;
                    this.parentNode.appendChild(this);
                    var dragTarget = d3.select(this);
                    var currentPanel = dragTarget.data()[0]
                    var posX = d3.event.dx
                    var posY = d3.event.dy

                    var newX = 0
                    var newY = 0

                    if (currentPanel.panelPosX || currentPanel.panelPosY)
                    {
                        newX = currentPanel.panelPosX + posX
                        newY = currentPanel.panelPosY + posY
                    }else{
                        newX = currentPanel.x + posX
                        newY = currentPanel.y + posY                        
                    }

                    dragTarget.attr("transform", function(d){d.panelPosX = newX; d.panelPosY = newY; return "translate(" + newX + "," + newY + ")"});            
                };

                
                
                nbInfoBox = svg.selectAll("g.nodeInfo")[0].length
                console.log("the current node", node);//, selection, selection.length)
                
                ib = svg.selectAll("g.nodeInfo"+node.baseID).data([node]).enter().append("g")
                        .attr("class", function(d){return "nodeInfo"+d.baseID})
                        .attr("transform", function(d){ return "translate(" + d.currentX + "," + d.currentY + ")";})
                        .call(d3.behavior.drag().on("drag", move))
                        
            
                ib.append("rect")
                    .classed("nodeInfo", true)
                    .attr("width", 200)
                    .attr("height", 200)
                    //.attr("x", function (d){return d.x;})
                    //.attr("y", function (d){return d.y;})
                    .style("fill", defaultFillColor)
                    .style("stroke-width", defaultBorderWidth)
                    .style("stroke", defaultBorderColor)

                ib.append("text")
                    .classed("nodeInfo", true)
                    .text("node information")
                    .attr("dx", 5)
                    .attr("dy", 15)
                    .style("fill", defaultTextColor)
                    .style("font-family", defaultTextFont)
                    .style("font-size", defaultTextSize)

                ib.append("text")
                    .classed("nodeInfo", true)
                    .text(function(d){return ("ID "+d.baseID)})
                    .attr("dx", 5)
                    .attr("dy", 30)
                    .style("fill", defaultTextColor)
                    .style("font-family", defaultTextFont)
                    .style("font-size", defaultTextSize)

                ib.append("text")
                    .classed("nodeInfo", true)
                    .text(function(d){return d.label})
                    .attr("dx", 5)
                    .attr("dy", 42)
                    .style("fill", defaultTextColor)
                    .style("font-family", defaultTextFont)
                    .style("font-size", defaultTextSize)

                ib.append("text")
                    .classed("nodeInfo", true)
                    .text("X")
                    .attr("dx", 186)
                    .attr("dy", 18)
                    .style("fill", defaultTextColor)
                    .style("font-family", "EntypoRegular")
                    .style("font-size", 30)
                    .on("click", function(d) {svg.selectAll("g.nodeInfo"+node.baseID).data([]).exit().remove();})

                //request catalysts
                //editable label
                console.log("node info appended", ib)
        }

        var attachInfoBox = function(target)
        {
                var cGraph = null
                var svg = null

                if (target == 'substrate')
                {        
                        cGraph = graph_substrate
                        svg = svg_substrate
                }

                if (target == 'catalyst')
                {        
                        cGraph = graph_catalyst
                        svg = svg_catalyst
                }
                
                eval("node_information_"+target+" = !node_information_"+target);

                if (!eval("node_information_"+target))
                {
                    svg.selectAll("g.infoBox").on("mouseout", function(){d3.select(this).select("rect.infoBox").style("fill",defaultFillColor); mouse_over_button = false;});
                    svg.selectAll("g.node").on("mouseover", null);
                    return
                }

                svg.selectAll("g.infoBox").on("mouseout", function(){d3.select(this).select("rect.infoBox").style("fill",highlightFillColor); mouse_over_button = false;});
                svg.selectAll("g.node").on("mouseover", function(d){addInfoBox(target, d)});
        
        }

        var toggleCatalystSyncOperator = function()
        {
            if (catalyst_sync_operator == "OR")
            {
                catalyst_sync_operator = "AND";
            }else{
                catalyst_sync_operator = "OR"
            }
            svg_catalyst.selectAll("g.toggleCatalystOp")
                .select("text")
                .text("operator "+catalyst_sync_operator)

        }

        // Adds a button to a specific interface with its callback
        // target, the string of the svg interface to draw the button in
        // positionNumber, the position at which we want to place the button
        // buttonLabel, the label of the button
        // className, the name of the class assigned to the button
        // callback, the callback function associated to the button click        
        var addButton = function(target, positionNumber, buttonLabel, className, callback)
        {
                var cGraph = null
                var svg = null

                if (target == 'substrate')
                {        
                        cGraph = graph_substrate
                        svg = svg_substrate
                }

                if (target == 'catalyst')
                {        
                        cGraph = graph_catalyst
                        svg = svg_catalyst
                }

                var bt = svg.selectAll("rect."+className).data([buttonLabel]).enter().append('g')
                        .attr("class", className)
                        .classed("interfaceButton", 1)
                        .attr("transform", function(d) { return "translate(" + 10 + "," + (10+25*positionNumber) + ")"; })
                        .on("click", function(){d3.select(this).select("rect").style("fill","yellow"); callback();})
                        .on("mouseover", function(){d3.select(this).select("rect").style("fill",highlightFillColor); mouse_over_button = true;})
                        .on("mouseout", function(){d3.select(this).select("rect").style("fill",defaultFillColor); mouse_over_button = false;})

                bt.append("rect")
                        .attr("class", className)
                         .classed("interfaceButton", 1)
                        .attr("width", 120)
                        .attr("height", 20)
                        .style("fill", defaultFillColor)
                        .style("stroke-width", defaultBorderWidth)
                        .style("stroke", defaultBorderColor)
                        

                bt.append("text")
                        .attr("class", className)
                         .classed("interfaceButton", 1)
                        .attr("dx", 5)
                        .attr("dy", 15)
                        .text(function(d){return d})
                        .style("fill", defaultTextColor)
                        .style("font-family", defaultTextFont)
                        .style("font-size", defaultTextSize)
        }

        var addSettingsButton = function()
        {
            svg = svg_substrate
            posSettings_x = width-30
            posSettings_y = 30

            //var width
            var btSettings = svg.selectAll("g.settings").data(["@"]).enter().append('g')
                .attr("class", "settings")
                .classed("interfaceButton", 1)
                .attr("transform", function(){return "translate("+posSettings_x+","+posSettings_y+")";})
            btSettings.append("text")
                .text(function(d){return "@"})
            	.style("fill", "lightgray")
                .style("font-family", "EntypoRegular")
                .style("font-size", 50)
        
            btSettings.on("click", function(){
                sGroup = svg.selectAll("settingsWindow").data(['WX']).enter().append("g")
                    .attr("class","settingsWindow")
                    .attr("transform", function(){return "translate("+ (posSettings_x-120)+","+posSettings_y+")";})

                sRect = sGroup.append("rect")
                    .attr("class","settingsWindow")
                    .attr("width", 120)
                    .attr("height", 120)
                    .style("fill", defaultFillColor)        
                    .style("stroke-width", defaultBorderWidth)
                    .style("stroke", defaultBorderColor)
                
                sGroup.append("text")
                    .attr("class","settingsWindow")
                    .attr("dx", 5)
                    .attr("dy", 15)
                    .text(function(){return "Settings"})
                    .style("font-family", defaultTextFont)
                    .style("fill", defaultTextColor)
                    .style("font-size", defaultTextSize)

                sGroup.append("text")
                    .attr("class","settingsWindow")
                    .attr("dx", 50)
                    .attr("dy", 115)
                    .text(function(){return "WX"})
                    .style("font-family", "EntypoRegular")
                    .style("fill", defaultTextColor)
                    .style("font-size", 30)
                    .on("click", function(){svg.selectAll(".settingsWindow").data([]).exit().remove();})

            })     
        }


        // This function adds the graph interactor buttons (move and select) to a target interface.
        // target, the string of the svg interface to draw the buttons in
        // positionNumber, the position at which we want to place the buttons
        // One button triggers the other one on or off, and refers to the global mode variable 'move_mode' or 'select_mode'
        var addGraphInteractorButtons = function(target, positionNumber)
        {
                var cGraph = null
                var svg = null

                if (target == 'substrate')
                {        
                        cGraph = graph_substrate
                        svg = svg_substrate
                }

                if (target == 'catalyst')
                {        
                        cGraph = graph_catalyst
                        svg = svg_catalyst
                }

                var btMove = svg.selectAll("rect.moveButton").data([{text:"move", colorOver:defaultFillColor, colorOut:highlightFillColor}]).enter().append('g')
                        .attr("class", "moveButton")
                        .classed("interfaceButton", 1)
                        .attr("transform", function(d) { return "translate(" + 10 + "," + (10+25*positionNumber) + ")"; })
                        .on("click", function(d){
                                d3.select(this).select("rect").style("fill","yellow"); 
                                toggleSelectMove(target);
                        })
                        .on("mouseover", function(d){
                                mouse_over_button = true;
                                if(!eval("move_mode_"+target)){
                                        d.colorOver = highlightFillColor; 
                                        d.colorOut = defaultFillColor;
                                }else{
                                        d.colorOver = defaultFillColor; 
                                        d.colorOut = highlightFillColor;
                                }
                                d3.select(this).select("rect").style("fill", d.colorOver);})
                        .on("mouseout", function(d){
                                mouse_over_button = false;
                                if(!eval("move_mode_"+target)){
                                        d.colorOver = highlightFillColor; 
                                        d.colorOut = defaultFillColor;
                                }else{
                                        d.colorOver = defaultFillColor; 
                                        d.colorOut = highlightFillColor;
                                }
                                d3.select(this).select("rect").style("fill", d.colorOut);})
                
                btMove.append("rect")
                        .attr("class", "moveButton")
                        .classed("interfaceButton", 1)
                        .attr("width", 120)
                        .attr("height", 20)
                        .style("fill", highlightFillColor)        
                        .style("stroke-width", defaultBorderWidth)
                        .style("stroke", defaultBorderColor)
                        //.on("mouseover", function(){d3.select(this).style("fill",highlightFillColor);})
                        //.on("mouseout", function(){d3.select(this).style("fill",defaultFillColor);})

                btMove.append("text")
                        .attr("class", "moveButton")
                        .classed("interfaceButton", 1)
                        .attr("dx", 5)
                        .attr("dy", 15)
                        .text(function(d){return d.text})
                        .style("font-family", defaultTextFont)
                        .style("fill", defaultTextColor)
                        .style("font-size", defaultTextSize)


                var btSelect = svg.selectAll("rect.selectButton").data([{text:"select", colorOver:highlightFillColor, colorOut:defaultFillColor}]).enter().append('g')
                        .attr("class", "selectButton")
                        .classed("interfaceButton", 1)
                        .attr("transform", function(d) { return "translate(" + 10 + "," + (10+25*(positionNumber+1)) + ")"; })
                        .on("click", function(d){
                                d3.select(this).select("rect").style("fill","yellow"); 
                                toggleSelectMove(target);   
                        })
                        .on("mouseover", function(d){
                                mouse_over_button = true;
                                if(!eval("select_mode_"+target)){
                                        d.colorOver = highlightFillColor; 
                                        d.colorOut = defaultFillColor;
                                }else{
                                        d.colorOver = defaultFillColor; 
                                        d.colorOut = highlightFillColor;
                                }
                                d3.select(this).select("rect").style("fill",d.colorOver);})
                        .on("mouseout", function(d){
                                mouse_over_button = false;
                                if(!eval("select_mode_"+target)){
                                        d.colorOver = highlightFillColor; 
                                        d.colorOut = defaultFillColor;
                                }else{
                                        d.colorOver = defaultFillColor; 
                                        d.colorOut = highlightFillColor;
                                }
                                d3.select(this).select("rect").style("fill",d.colorOut);})
                
                btSelect.append("rect")
                        .attr("class", "selectButton")
                        .classed("interfaceButton", 1)
                        .attr("width", 120)
                        .attr("height", 20)
                        .style("fill", defaultFillColor)        
                        .style("stroke-width", defaultBorderWidth)
                        .style("stroke", defaultBorderColor)
                        //.on("mouseover", function(d){d3.select(this).style("fill",d.colorOver);})
                        //.on("mouseout", function(d){d3.select(this).style("fill",d.colorOut);})

                btSelect.append("text")
                        .attr("class", "selectButton")
                        .classed("interfaceButton", 1)
                        .attr("dx", 5)
                        .attr("dy", 15)
                        .text(function(d){return d.text})
                        .style("fill", defaultTextColor)
                        .style("font-family", defaultTextFont)
                        .style("font-size", defaultTextSize)
        }

        // This function adds a small frame that displays the entanglement informations while they are updated
        // target, the string of the svg interface to draw the frame in
        var addEntanglementFeedback = function(target)
        {
                var cGraph = null
                var svg = null

                if (target == 'substrate')
                {        
                        cGraph = graph_substrate
                        svg = svg_substrate
                }

                if (target == 'catalyst')
                {        
                        cGraph = graph_catalyst
                        svg = svg_catalyst
                }

                var coh = svg.selectAll("rect entanglement").data(["entanglement"]).enter().append('g')
                        .attr("transform", function(d) { return "translate(" + 10 + "," + 395 + ")"; })
                
                coh.append("rect")
                        .attr("class", "entanglementframe")
                        .classed("interfaceButton", 1)
                        .attr("width", 120)
                        .attr("height", 90)
                        .style("fill-opacity", 0)
                        .style("stroke-width", 1)
                        .style("stroke", 'black')        

                coh.append("text")
                        .attr('class', 'entanglementlabel')
                        .classed("interfaceButton", 1)
                        .attr("dx", 5)
                        .attr("dy", 15)
                        .text("Entanglement")
                        .style("fill", 'black')
                        .style("font-family", defaultTextFont)
                        .style("font-size", defaultTextSize)

                coh.append("text")
                        .attr('class', 'intensitylabel')
                        .classed("interfaceButton", 1)
                        .attr("dx", 10)
                        .attr("dy", 35)
                        .text("intensity:")
                        .style("fill", 'black')
                        .style("font-size", defaultTextSize)
                        .style("font-family", defaultTextFont)

                coh.append("text")
                        .attr('class', 'intensity')
                        .classed("interfaceButton", 1)
                        .attr("dx", 110)
                        .attr("dy", 50)
                        .text(function(d){return ""+entanglement_intensity})
                        .style("fill", 'blue')
                        .style("font-family", defaultTextFont)
                        .style("font-size", defaultTextSize)
                        .style('text-anchor', 'end')

                coh.append("text")
                        .attr('class', 'homogeneitylabel')
                        .classed("interfaceButton", 1)
                        .attr("dx", 10)
                        .attr("dy", 70)
                        .attr("width", 120)
                        .style("font-family", defaultTextFont)
                        .text('homogeneity:')
                        .style("font-size", defaultTextSize)
                        .style("fill", 'black')

                coh.append("text")
                        .attr('class', 'homogeneity')
                        .classed("interfaceButton", 1)
                        .attr("dx", 110)
                        .attr("dy", 85)
                        .text(function(d){return ""+entanglement_homogeneity})
                        .style('text-anchor', 'end')
                        .style("font-family", defaultTextFont)
                        .style("fill", 'blue')
                        .style("font-size", defaultTextSize)

        }

        var eraseAllInterface = function(target)
        {
                var cGraph = null
                var svg = null

                if (target == 'substrate')
                {        
                        cGraph = graph_substrate
                        svg = svg_substrate
                }

                if (target == 'catalyst')
                {        
                        cGraph = graph_catalyst
                        svg = svg_catalyst
                }

                var coh = svg.selectAll(".interfaceButton").data([]).exit().remove()
                

        }

        var resetView = function(target)
        {
                var cGraph = null
                var svg = null

                if (target == 'substrate')
                {        
                        cGraph = graph_substrate
                        svg = svg_substrate
                }

                if (target == 'catalyst')
                {        
                        cGraph = graph_catalyst
                        svg = svg_catalyst
                }

                nodeDatum = svg.selectAll("g.node").data()
                // strangely the matrix that should be applied by transform is squared?! so we adapt the nodes values
                nodeDatum.forEach(function(d){d.currentX = d.x;
                                              d.currentY = d.y;});
                
                svg.selectAll(".node,.link").attr("transform","translate(" + 0 + "," +  0 + ") scale(" +  1 + ")")
                svg.selectAll("text.node").style("font-size", function(){ return 12;});
                addInterfaceSubstrate();
                addInterfaceCatalyst();
                entanglementCaught();
        }

        var resetSize = function(target)
        {
                var cGraph = null
                var svg = null

                if (target == 'substrate')
                {        
                        cGraph = graph_substrate
                        svg = svg_substrate
                }

                if (target == 'catalyst')
                {        
                        cGraph = graph_catalyst
                        svg = svg_catalyst
                }
                
                cGraph.nodes().forEach(function(d){d.viewMetric = 3;})
                graph_drawing = graphDrawing(cGraph, svg)
                graph_drawing.resize(cGraph, 0)
        }


        // This function add all the interface elements for the catalyst view
        var addInterfaceCatalyst = function()
        {
                var target = "catalyst";
                
                eraseAllInterface(target);

                addButton(target, 0, "induced subgraph", "button1", function(){sendSelection(getSelection(target), target)});
                addButton(target, 1, "force layout", "button2", function(){callLayout("FM^3 (OGDF)", target)});
                addButton(target, 2, "circular layout", "button3", function(){callLayout("Circular", target)});
                addButton(target, 3, "random layout", "button4", function(){callLayout("Random", target)});
                addButton(target, 4, "reset view", "button5", function(){resetView(target)});
                addButton(target, 5, "degree metric", "button6", function(){callFloatAlgorithm("Degree", target)});
                addButton(target, 6, "btw. centrality", "button7", function(){callFloatAlgorithm("Betweenness Centrality", target)});
                addButton(target, 7, "reset size", "button8", function(){resetSize(target)});  
                addButton(target, 8, "hide labels", "showHideLabels", function(){showhideLabels(target)});              
                addButton(target, 9, "hide links", "showHideLinks", function(){showhideLinks(target)});
                addButton(target, 10, "node information", "infoBox", function(){attachInfoBox(target)});
                addButton(target, 11, "operator "+catalyst_sync_operator, "toggleCatalystOp", function(){toggleCatalystSyncOperator()});

                addGraphInteractorButtons(target, 12);
        
                addSettingsButton();

        }

        // This function add all the interface elements for the substrate view
        var addInterfaceSubstrate = function()
        {
                var target = 'substrate'

                eraseAllInterface(target);

                addButton(target, 0, "induced subgraph", "button1", function(){sendSelection(getSelection(target), target)});
                addButton(target, 1, "force layout", "button2", function(){callLayout("FM^3 (OGDF)", target)});
                addButton(target, 2, "circular layout", "button3", function(){callLayout("Circular", target)});
                addButton(target, 3, "random layout", "button4", function(){callLayout("Random", target)});
                addButton(target, 4, "reset view", "button5", function(){resetView(target)});
                addButton(target, 5, "degree metric", "button6", function(){callFloatAlgorithm("Degree", target)});
                addButton(target, 6, "btw. centrality", "button7", function(){callFloatAlgorithm("Betweenness Centrality", target)});
                addButton(target, 7, "analyse", "button8", function(){analyseGraph()});
                addButton(target, 8, "reset size", "button9", function(){resetSize(target)});
                addButton(target, 9, "hide labels", "showHideLabels", function(){showhideLabels(target)});
                addButton(target, 10, "hide links", "showHideLinks", function(){showhideLinks(target)});
                addButton(target, 11, "node information", "infoBox", function(){attachInfoBox(target)});
                
                addGraphInteractorButtons(target, 12);
                addEntanglementFeedback(target);
        }

        // This function updates the entanglement values displayed in the entanglement frame of the substrate view
        // The entanglement intensity drives the color of the frame following a Brewer's scale (www.colorbrewer2.org).
        var entanglementCaught = function()
        {
                var brewerSeq = ['#FEEDDE', '#FDD0A2', '#FDAE6B', '#FD8D3C', '#E6550D', '#A63603']
                svg_substrate.selectAll("text.homogeneity").text(function(d){return ""+round(entanglement_homogeneity,5)});
                svg_substrate.selectAll("text.intensity").text(function(d){return ""+round(entanglement_intensity,5)});
                var index = Math.round(entanglement_intensity*5)%6
                svg_substrate.selectAll("rect.entanglementframe").transition().style('fill-opacity', 1)
                        .style("fill", brewerSeq[index])
                if(lasso_catalyst) lasso_catalyst.fillColor = brewerSeq[index]
                if(lasso_substrate) lasso_substrate.fillColor = brewerSeq[index]
        }

        // This is a handy function to round numbers
        var round = function(number, digits)
        {
                var factor = Math.pow(10, digits);
                return Math.round(number*factor)/factor;
        }


        // This function toggles the 'select' and 'move' modes for the interactors
        // target, the string value of the target svg view
        var toggleSelectMove = function(target)
        {

                if (!target)
                        return

                var svg = null

                if (target == "catalyst")
                {
                        svg = svg_catalyst
                        //select_mode = select_mode_catalyst
                        //move_mode = move_mode_catalyst
                }
        
                if (target == "substrate")
                {
                        svg = svg_substrate
                        //select_mode = select_mode_substrate
                        //move_mode = move_mode_substrate
                }

                eval("select_mode_"+target+" = ! select_mode_"+target);
                eval("move_mode_"+target+" = ! move_mode_"+target);

                if(eval("select_mode_"+target))
                {
                        svg.select('rect.moveButton').style('fill', defaultFillColor);
                        svg.select('rect.selectButton').style('fill', highlightFillColor);
                        addLasso(target);
                        removeZoom(target);
                }

                if(eval("move_mode_"+target))
                {
                        svg.style("cursor", "all-scroll");
                        svg.select('rect.moveButton').style('fill', highlightFillColor);
                        svg.select('rect.selectButton').style('fill', defaultFillColor);                        
                        removeLasso(target);
                        addZoom(target);
                }
        }

        // 
        var showhideLabels = function(target)
        {

                if (!target)
                        return

                var svg = null

                if (target == "catalyst")
                {
                        svg = svg_catalyst
                }
        
                if (target == "substrate")
                {
                        svg = svg_substrate
                }

                eval("show_labels_"+target+" = ! show_labels_"+target); 

                if(eval("show_labels_"+target))
                {
                    //svg.selectAll('text.node').text(function(d) { return d.label; });
                    svg.selectAll('text.node').attr("visibility", function(d) { return "visible";});
                    svg.select('text.showHideLabels').text('hide labels');
                    svg.selectAll('g.node').on("mouseover", function(d){d.mouseOver = false; return null;})
                                           .on("mouseout", null);
                }else{
                    //svg.selectAll('text.node').text(function(d) {if (d.selected){return d.label;} else {return "";}});
                    svg.selectAll('text.node').attr("visibility", function(d) {if (d.selected || d.labelVisibility){d.labelVisibility = true; return "visible";} else {d.labelVisibility = false; return "hidden";}});
                    svg.select('text.showhideLabels').text('show labels');
                    //svg.selectAll('g.node').on("mouseover", function(d){d3.select(this).select("text.node").text(d.label);})
                    //                       .on("mouseout", function(d){d3.select(this).select("text.node").text("")});
                    svg.selectAll('g.node').on("mouseover", function(d){d.mouseOver = true; d3.select(this).select("text.node").attr("visibility", "visible");})
                                           .on("mouseout", function(d){if (!d.labelVisibility) { d.mouseOver = false; d3.select(this).select("text.node").attr("visibility", "hidden");}});
                }
        }


        var showhideLinks = function(target)
        {

                if (!target)
                        return

                var svg = null

                if (target == "catalyst")
                {
                        svg = svg_catalyst
                }
        
                if (target == "substrate")
                {
                        svg = svg_substrate
                }

                eval("show_links_"+target+" = ! show_links_"+target);

                if(eval("show_links_"+target))
                {
                    svg.selectAll('g.link').attr("visibility","visible");
                    svg.select('text.showHideLinks').text('hide links');
                }else{
                    svg.selectAll('g.link').attr("visibility","hidden");
                    svg.select('text.showhideLinks').text('show links');
                }
        }

        var includeFormParam = function (target)
        {
                myinput =  svg.append("foreignObject")
                        .attr("width", 100)
                        .attr("height", 100)
                        .append("xhtml:body")
                        .html("<form><input type=checkbox id=check /></form>")
                        .on("click", function(d, i){
                            console.log(svg.select("#check").node().checked);
                        });
                myinput =  svg.append("foreignObject")
                        .attr("width", 300)
                        .attr("height", 100)
                        .attr("x", 200)
                        .attr("y", 200)
                        .append("xhtml:body")
                        .html("<form><input type=input id=input /></form>")
                        //.on("click", function(d, i){
                        //    console.log(svg.select("#input").node().value);
                        //});
                
                console.log("input created", myinput);    
        }

        // This function associate a d3.svg.brush element to select nodes in a view
        // target, the string value of the target svg view 
        // This function is unused and a bit deprecated but one can activate it anytime
        var addBrush = function(target)
        {
                var svg = null
                var graph = null

                if (target == "catalyst")
                {
                        svg = svg_catalyst
                        graph = graph_catalyst                        
                }
        
                if (target == "substrate")
                {
                        svg = svg_substrate
                        graph = graph_substrate
                }
                        
                if (!target)
                        return

                var h = svg.attr("height")
                var w = svg.attr("width")
                var buttonWidth = 131
                
                var xScale = d3.scale.linear().range([buttonWidth, w])
                var yScale = d3.scale.linear().range([0,h])

                console.log("svg element: ",svg, w, h)
                

                var brush = svg.append("g")
                    .attr("class", "brush"+target)
                    .call(d3.svg.brush().x(xScale).y(yScale)
                    .on("brushstart", brushstart)
                    .on("brush", brushmove)
                    .on("brushend", brushend))
                    .style('stroke', 'black')
                    .style('stroke-width', 2)
                    .style('fill-opacity', .125)
                    .style('shape-rendering', 'crispEdges')



                function brushstart() {
                  svg.classed("selecting", true);
                }

                var prevSelList = [];

                // This function will check the nodes intersections and synchronize accordingly
                function brushmove() {
                          var e = d3.event.target.extent();
                          var node = svg.selectAll("g.node")
                          var selList = []
                          node.classed("selected", function(d) {
                                        //console.log('object d ',d);
                                        //console.log('pos (',e,') against (',d.x/w,',',d.y/h);
                                    wNorm = w - buttonWidth
                                    d.selected = e[0][0] <= (d.currentX-buttonWidth+1)/wNorm && (d.currentY-buttonWidth+1)/wNorm <= e[1][0]
                                        && e[0][1] <= d.currentY/h && d.currentY/h <= e[1][1];
                                    return d.selected;
                                  }).select("circle.node").style('fill', function(d){
                                        if (d.selected)
                                        { selList.push(d.baseID); return 'red';}
                                        return 'steelblue';
                          })

                        selList.sort()
                        if(selList.length>0)
                        {        
                                if(selList.length == prevSelList.length)
                                {
                                        var i = 0;
                                        var iMax = selList.length;
                                        while(i<iMax && selList[i] == prevSelList[i])
                                                i++;
                                        if (i != iMax)
                                        {
                                                prevSelList.length = 0
                                                prevSelList = selList.slice(0);
                                                syncGraph(getSelection(target), target)
                                        }
                                }else{
                                        
                                                prevSelList.length = 0
                                                prevSelList = selList.slice(0);
                                                syncGraph(getSelection(target), target)
                                }
                        }
                                
                        
                
                
                  //syncGraph(getSelection(target), target)
                //console.log(nbSelected, 'elements selected')
                }

                function brushend() {
                  svg.classed("selecting", !d3.event.target.empty());
                }



        }

        // This function creates a lasso brush interactor for a specific target, it also redefined
        // the brush intersection function, and applies actions to the selected target.
        // target, the string value of the target svg view         
        var createLasso = function(target)
        {
                if (!target)
                        return

                var svg = null
                var graph = null
                var myL = null

                if (target == "catalyst")
                {
                        svg = svg_catalyst
                        graph = graph_catalyst        
                        lasso_catalyst = new lasso(svg);
                        myL = lasso_catalyst                
                }
        
                if (target == "substrate")
                {
                        svg = svg_substrate
                        graph = graph_substrate
                        lasso_substrate = new lasso(svg);
                        myL = lasso_substrate
                }
                
                var prevSelList = [];

                myL.canMouseUp = function(e)
                {
                    if (!mouse_over_button)
                        this.mouseUp(e)
                }
            
                myL.canMouseMove = function(e)
                {
                    if (!mouse_over_button)
                        this.mouseMove(e)
                }
                
                myL.canMouseDown = function(e)
                {
                    if (!mouse_over_button)
                        this.mouseDown(e)
                }

                // redefines the intersection function
                // applies keyboard modifiers, control extends the selection, shift removes from the currect selection
                // once the selection is made, it applies the synchronization function syncGraph() to the selected nodes
                // selection colors are hardcoded but this should be changed
                myL.checkIntersect = function()
                {
                        var __g = this
                        var selList = []
                        var e=window.event
                        //console.log('control pushed ', e.ctrlKey)
                        //console.log("svg operating the selection", svg)
                        svg.selectAll("g.node").classed("selected", function(d){
                                        console.log('current obj', d)
                                        var x = 0;
                                        var y = 0;
                                        if (!('currentX' in d))
                                        {
                                                x = d.x;
                                                y = d.y;
                                        } else
                                        { 
                                                x = d.currentX;
                                                y = d.currentY;
                                        }
                                        var pointArray = [];
                                        if (__g.isLasso())
                                        {
                                                pointArray = __g.pointList;
                                        }else{
                                                var p0 = __g.pointList[0];
                                                var p1 = __g.pointList[__g.pointList.length-1];                        
                                                pointArray = [[p0[0], p0[1]],[p0[0], p1[1]], [p1[0], p1[1]], [p1[0], p0[1]]];
                                        }
                                        //console.log("before")
                                        

                                        if ((e.ctrlKey || e.metaKey) && d.selected == true)
                                                return true;

                                        var intersects = __g.intersect(pointArray, x, y)
                                        if (intersects) console.log("node intersects", d)
                                        //console.log('result of intersects? ',intersects,pointArray,x,y)

                                        if (e.shiftKey && intersects)
                                        {
                                                console.log("shift pressed and intersects so return false");
                                                d.selected = false;
                                        }
                                        else if (e.shiftKey && !intersects && d.selected == true)
                                        {
                                                console.log("shift pressed and doesnt intersects and true so return true");
                                                d.selected = true;
                                        }else
                                        {    
                                                //console.log ("d.selected = ",intersects);
                                                d.selected = intersects;
                                        }
                                        console.log("returning selection:",d.selected)
                                        return d.selected

                                })
                                .select("circle.node").style('fill', function(d){
                                        if (e.ctrlKey && d.selected == true)
                                        {
                                                selList.push(d.baseID)
                                                return 'red';
                                        }
                                        if (d.selected){
                                                selList.push(d.baseID)
                                                return 'red';
                                        }else
                                                return 'steelblue';
                                });

                        
                        selList.sort()
                        console.log("selection list: ",selList, " with length ", selList.length)
                        
                        if(selList.length>0)// && target == "substrate")
                        {        
                                if(selList.length == prevSelList.length)
                                {
                                        var i = 0;
                                        var iMax = selList.length;
                                        while(i<iMax && selList[i] == prevSelList[i])
                                                i++;
                                        if (i != iMax)
                                        {
                                                prevSelList.length = 0
                                                prevSelList = selList.slice(0);
                                                syncGraph(getSelection(target), target)
                                        }
                                }else{
                                        
                                                prevSelList.length = 0
                                                prevSelList = selList.slice(0);
                                                syncGraph(getSelection(target), target)
                                }
                        }
                        else
                        {   
                            svg.selectAll("g.node").select("circle.node").style('fill', 'steelblue');
                            svg.selectAll("g.link").select("path.link").style('stroke', 'gray');
                            if (target == "catalyst")
                                resetSize("substrate");
                            if (target == "substrate")
                                resetSize("catalyst");
                            prevSelList = selList.slice(0);
                            console.log("warning: the selection list is empty");
                            
                        }
                }        
                
        }

        // Applies the lasso interactor to a specific svg target as callback to the mouse events.
        // target, the string value of the target svg view         
        var addLasso = function(target)
        {
                if (!target)
                        return

                var mySvg = null
                var myL = null

                if (target == "catalyst")
                {
                        mySvg = svg_catalyst
                        myL = lasso_catalyst                
                }
        
                if (target == "substrate")
                {
                        mySvg = svg_substrate
                        myL = lasso_substrate
                }

                mySvg.on("mouseup", function(d){myL.canMouseUp(d3.mouse(this))});
                mySvg.on("mousedown", function(d){myL.canMouseDown(d3.mouse(this))});
                mySvg.on("mousemove", function(d){myL.canMouseMove(d3.mouse(this))});        
        }


        // Removes the lasso interactor from a specific svg target's callbacks to its mouse events.
        // target, the string value of the target svg view         
        var removeLasso = function(target)
        {
                if (!target)
                        return

                var svg = null

                if (target == "catalyst")
                {
                        svg = svg_catalyst
                }
        
                if (target == "substrate")
                {
                        svg = svg_substrate
                }

                svg.on("mouseup", null);
                svg.on("mousedown", null);
                svg.on("mousemove", null);
        }


        // Removes the lasso interactor from a specific svg target's callbacks to its mouse events.
        // target, the string value of the target svg view         
        var removeZoom = function(target)
        {
                if (!target)
                        return

                var svg = null

                if (target == "catalyst")
                {
                        svg = svg_catalyst
                }
        
                if (target == "substrate")
                {
                        svg = svg_substrate
                }
        svg.on("mousedown.zoom", null)
            .on("mousewheel.zoom", null)
            .on("mousemove.zoom", null)
            .on("DOMMouseScroll.zoom", null)
            .on("dblclick.zoom", null)
            .on("touchstart.zoom", null)
            .on("touchmove.zoom", null)
            .on("touchend.zoom", null);
               // svg.on("mouseup", null);
               // svg.on("mousedown", null);
               // svg.on("mousemove", null);
        }

        // This function allows to map a callback to a keyboard touch event
        // It is not currently used.
        // callback, the callback function
        var registerKeyboardHandler = function(callback) 
        {
                var callback = callback;
                d3.select(window).on("keydown", callback);  
        };

        
        // Adds a zoom interactor to a specific svg target as callbacks to its mouse events.
        // target, the string value of the target svg view         
        var addZoom = function(target)
        {

                if (!target)
                        return

                var svg = null

                if (target == "catalyst")
                {
                        svg = svg_catalyst
                }
        
                if (target == "substrate")
                {
                        svg = svg_substrate
                }

                // Defines the zoom behavior and updates that data currentX and currentY values to match with intersections
                console.log("preparing to add zoom in view",target);
                svg.call (d3.behavior.zoom()
                            .translate ([0, 0])
                            .scale (1.0)
                            .scaleExtent([0.5, 2.0])
                            .on("zoom", function() {
                                
                                if (!eval("move_mode_"+target))
                                {
                                         return;
                                }

                                nodeDatum = svg.selectAll("g.node").data()
                                // strangely the matrix that should be applied by transform is squared?! so we adapt the nodes values
                                //nodeDatum.forEach(function(d){d.currentX = (d.x*Math.pow(d3.event.scale,2)+d3.event.translate[0]*(1+d3.event.scale));
                                //                              d.currentY = (d.y*Math.pow(d3.event.scale,2)+d3.event.translate[1]*(1+d3.event.scale));
                                //                                });

                                nodeDatum.forEach(function(d){d.currentX = (d.x*d3.event.scale+d3.event.translate[0]);
                                                              d.currentY = (d.y*d3.event.scale+d3.event.translate[1]);
                                                                });
                                

                                svg.selectAll("g.node,g.link").attr("transform","translate(" + d3.event.translate[0] + "," +  d3.event.translate[1] + ") scale(" +  d3.event.scale + ")")
                                svg.selectAll("text.node").style("font-size", function(){ return Math.ceil(12/d3.event.scale);});
                                addInterfaceSubstrate();
                                addInterfaceCatalyst();
                                entanglementCaught();
        
                            })
                        );
        }


        // Loads the data from a json file, if no JSON is passed, then we load the default JSON stored in
        // 'json_address', otherwise it loads the given json file.
        // It is first formatted correctly, locally, then sent to tulip to be initialized (so it is modified
        // again), and analyzed.
        var loadData = function(json)
        {
                //d3.json(tulip_address+"?n=50", function(json) {
                //d3.json(json_address, function(data) {

                //for local use
                if (json=="" || json==null)
                {
                        var jqxhr = $.getJSON(json_address, function(){ 
                          console.log("success");
                        })

                        .error(function(e) { alert("error!!", e); })
                        .complete(function() { console.log("complete"); })
                        .success(function(data,b) { 
                                //console.log('json loaded')
                                //console.log(data)
                                addBaseID(data, "id")
                                jsonData = JSON.stringify(data)
                                loadJSON(data)
                                //console.log('sending to tulip... :')
                                //console.log(jsonData)
                                createTulipGraph(jsonData)
                                analyseGraph()
                        });
                }
                else
                {
                        //console.log('we should now send it as we have it:')
                        //console.log(json)
                        data = $.parseJSON(json)
                        //data = eval(json)
                        //console.log('data loaded:')
                        //console.log(data);
                        addBaseID(data, "id")
                        json = JSON.stringify(data)
                        loadJSON(data)
                        console.log("I am creating the graph in Tulip")
                        createTulipGraph(json)
                        console.log("I should now analyse the graph", sessionSid)
                        analyseGraph()
                        console.log("graph analysed",sessionSid)
                        
                }
        }


        // We create the interfaces for each svg
        addInterfaceSubstrate();
        addInterfaceCatalyst();
        
        //console.log("beginning of the generation", graph_substrate.nodes(), graph_catalyst.nodes());

        // This is the tricky part, because the json given to the function can be of many shapes.
        // If it is a query, we call tulip to perform the search
        // if it is a given file we load it normally
        // other wise we load the default function
        if (originalJSON != null && originalJSON != "" )
        {
                console.log('orginialJSON not null', originalJSON)
                if ('query' in originalJSON)
                {
                        console.log('query is in json', originalJSON)
                        var recievedGraph  = callSearchQuery(originalJSON)
                        loadData(recievedGraph);
                        //console.log('new query: ',xyz)
                }
                else if ('file' in originalJSON)
                {
                        loadData(originalJSON.file);
                }
                else loadData();
        }

        // we create then the basic interactors
        createLasso("substrate");
        createLasso("catalyst");
        addZoom("substrate");
        addZoom("catalyst");
};

