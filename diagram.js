const $ = go.GraphObject.make; 
let diagram = null;             
let palette = null;             

let isSimulationMode = false;
let simType = 'manual'; 
let simStep = 0; 
let simSourceNode = null;


let activeRealtimeSims = 0;
let realtimeSuccessCount = 0;
let realtimeFailCount = 0;
let realtimeTotalScheduled = 0;


window.initDiagram = initDiagram;
window.getDiagramJSON = getDiagramJSON;
window.loadDiagramModel = loadDiagramModel;
window.startTracerouteMode = startTracerouteMode; 
window.startRealtimeSim = startRealtimeSim;       
window.saveConfig = saveConfig;
window.addRouteRow = addRouteRow; 


function initDiagram() {
    if (!document.getElementById("networkDiagram")) return; 

  
    if (diagram !== null) {
        diagram.div = null; 
    }

    diagram = $(go.Diagram, "networkDiagram", {
        "undoManager.isEnabled": true,
        "toolManager.hoverDelay": 100,
        "initialContentAlignment": go.Spot.Center,
        "linkReshapingTool.isEnabled": true,
        "linkingTool.portGravity": 20,
        "relinkingTool.portGravity": 20,
        "linkDrawn": (e) => { e.subject.data.key = go.Key.generateKey(); }
    });

    
    const nodeContextMenu = $(go.Adornment, "Vertical",
        $("ContextMenuButton",
            $(go.TextBlock, "⚙️ Configure Device"),
            { click: (e, obj) => openConfigModal(obj.part.adornedPart) }
        ),
        $("ContextMenuButton",
            $(go.TextBlock, "❌ Delete"),
            { click: (e, obj) => e.diagram.commandHandler.deleteSelection() }
        )
    );

    
    const createDeviceTemplate = (category, imageSource, color, width=50) => {
        return $(go.Node, "Vertical",
            {
                locationSpot: go.Spot.Center,
                contextMenu: nodeContextMenu, 
                
                
                doubleClick: (e, node) => {
                    
                    if(isSimulationMode) {
                        isSimulationMode = false;
                        simStep = 0;
                        diagram.clearHighlighteds();
                        updateStatus("Simulation Cancelled. Configuring device...");
                    }
                    openConfigModal(node);
                },
                
                
                click: (e, node) => {
                    if (isSimulationMode && simType === 'manual') handleManualSelection(node);
                },
                
                
                toolTip: $(go.Adornment, "Auto",
                    $(go.Shape, { fill: "#1e293b", stroke: "#475569" }),
                    $(go.TextBlock, { margin: 8, stroke: "#e2e8f0", font: "12px sans-serif" },
                        new go.Binding("text", "", d => {
                            let txt = `Name: ${d.name}\nIP: ${d.ip || 'Unset'}\nMask: ${d.mask || '24'}`;
                            if(d.gateway) txt += `\nGW: ${d.gateway}`;
                            if(d.routingTable && d.routingTable.length > 0) txt += `\nRoutes: ${d.routingTable.length}`;
                            return txt;
                        }))
                )
            },
            new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
            new go.Binding("isHighlighted", "isHighlighted", h => h).ofObject(),
            
            $(go.Panel, 'Spot',
                { width: width * 1.5, height: width * 1.5 },
                { portId: '', fromLinkable: true, toLinkable: true, cursor: 'pointer' },
                
                
                $(go.Shape, "Circle", 
                    { fill: null, stroke: null, strokeWidth: 0, width: width * 1.4, height: width * 1.4 },
                    new go.Binding("stroke", "isHighlighted", h => h ? "var(--neon-green)" : null).ofObject(),
                    new go.Binding("strokeWidth", "isHighlighted", h => h ? 3 : 0).ofObject()
                ),
                
                $(go.Picture, { 
                    name: "Picture",
                    source: imageSource, 
                    width: width, 
                    height: width, 
                    errorFunction: (pic, e) => { pic.visible = false; }
                }),
                
                $(go.Shape, "RoundedRectangle", { 
                    width: width, height: width, fill: color, visible: false 
                }, new go.Binding("visible", "visible", v => !v).ofObject("Picture"))
            ),
            
            $(go.Panel, 'Vertical',
                $(go.TextBlock, { margin: 2, font: 'bold 14px Inter, sans-serif', stroke: '#e2e8f0' }, 
                    new go.Binding('text', 'name')),
                $(go.TextBlock, { margin: 2, font: '11px Inter, sans-serif', stroke: color }, 
                    new go.Binding('text', 'ip'))
            )
        );
    };

    
    diagram.nodeTemplateMap.add("PC", createDeviceTemplate("PC", "images/pc icon.png", "#81e6d9"));
    diagram.nodeTemplateMap.add("Laptop", createDeviceTemplate("Laptop", "images/laptop icon.png", "#a3a3a3"));
    diagram.nodeTemplateMap.add("Server", createDeviceTemplate("Server", "images/webserver.png", "#f472b6", 55)); 
    diagram.nodeTemplateMap.add("Printer", createDeviceTemplate("Printer", "images/printer.png", "#fbbf24", 50)); 
    diagram.nodeTemplateMap.add("Router", createDeviceTemplate("Router", "images/router icon.png", "#f6e05e", 60));
    diagram.nodeTemplateMap.add("Switch", createDeviceTemplate("Switch", "images/switch icon.png", "#60a5fa", 60));
    diagram.nodeTemplateMap.add("Cloud", createDeviceTemplate("Cloud", "images/internet.png", "#38bdf8", 70));
    diagram.nodeTemplateMap.add("AccessPoint", createDeviceTemplate("AccessPoint", "images/wireless ap.png", "#a855f7", 50));

    
    diagram.linkTemplate = $(go.Link, 
        { routing: go.Link.Orthogonal, corner: 5, reshapable: true, resegmentable: true, toShortLength: 2 },
        $(go.Shape, { strokeWidth: 2, stroke: "#475569" }, 
            new go.Binding("stroke", "isHighlighted", h => h ? "#38bdf8" : "#475569").ofObject(),
            new go.Binding("strokeWidth", "isHighlighted", h => h ? 4 : 2).ofObject()
        ),
        $(go.Shape, { toArrow: "Standard", scale: 0.5, fill: "#475569", stroke: null }) 
    );

    
    if (palette === null) {
        palette = $(go.Palette, 'componentPalette', {
            nodeTemplateMap: diagram.nodeTemplateMap,
            layout: $(go.GridLayout, { cellSize: new go.Size(1, 1), spacing: new go.Size(15, 15) })
        });
        
        palette.model.nodeDataArray = [
            { category: 'PC', name: 'PC', ip: '192.168.1.10', mask: '255.255.255.0', gateway: '192.168.1.1' },
            { category: 'Laptop', name: 'Laptop', ip: '192.168.1.11', mask: '255.255.255.0', gateway: '192.168.1.1' },
            { category: 'Server', name: 'Web Server', ip: '192.168.1.100', mask: '255.255.255.0', gateway: '192.168.1.1' },
            { category: 'Printer', name: 'Printer', ip: '192.168.1.20', mask: '255.255.255.0', gateway: '192.168.1.1' },
            { category: 'Router', name: 'Router', ip: '192.168.1.1', mask: '255.255.255.0', routingTable: [] },
            { category: 'Switch', name: 'Switch', ip: '', mask: '' },
            { category: 'Cloud', name: 'Internet', ip: '8.8.8.8', mask: '255.0.0.0' },
            { category: 'AccessPoint', name: 'Wireless AP', ip: '192.168.1.2', mask: '255.255.255.0' }
        ];
    }
    diagram.model = new go.GraphLinksModel();
}


function isValidIP(ip) {
    if(!ip) return false;
    const regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return regex.test(ip.trim());
}


function openConfigModal(node) {
    if(!node || !node.data) return;
    const modal = document.getElementById('configModal');
    const endDevSet = document.getElementById('end-device-settings');
    const routerSet = document.getElementById('router-settings');
    const gatewayInput = document.getElementById('cfg-gateway');
    const routingTableBody = document.getElementById('routingTableBody');

    if(!modal) return;

    const data = node.data;
    document.getElementById('cfg-node-key').value = data.key;
    document.getElementById('cfg-device-type').value = data.category;
    document.getElementById('cfg-name').value = data.name || "";
    document.getElementById('cfg-ip').value = data.ip || "";
    document.getElementById('cfg-mask').value = data.mask || "255.255.255.0";

    if(routingTableBody) routingTableBody.innerHTML = '';

   
    if (data.category === 'Router') {
        endDevSet.style.display = 'none';
        routerSet.style.display = 'block';
        loadRoutingTableUI(data.routingTable || []);
    } else if (['PC', 'Laptop', 'Server', 'Printer'].includes(data.category)) {
        endDevSet.style.display = 'block';
        routerSet.style.display = 'none';
        if(gatewayInput) gatewayInput.value = data.gateway || "";
    } else {
        endDevSet.style.display = 'none';
        routerSet.style.display = 'none';
    }
    modal.style.display = 'flex';
    modal.style.zIndex = '10000';
}

function loadRoutingTableUI(routes) {
    routes.forEach((route) => {
        addRouteRow(route.dest, route.nextHop);
    });
}

function addRouteRow(destVal = "", nextHopVal = "") {
    const tbody = document.getElementById('routingTableBody');
    if(!tbody) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input type="text" class="tbl-input-dest" value="${destVal}" placeholder="192.168.2.0"></td><td><input type="text" class="tbl-input-hop" value="${nextHopVal}" placeholder="192.168.1.2"></td><td><button type="button" onclick="this.parentElement.parentElement.remove()" class="btn-del-row"><i class="fas fa-trash"></i></button></td>`;
    tbody.appendChild(tr);
}

function saveConfig() {
    let keyString = document.getElementById('cfg-node-key').value;
    let node = diagram.findNodeForKey(keyString);
    if (!node) node = diagram.findNodeForKey(parseInt(keyString));
    if (!node) { alert("Error: Device not found."); return; }

    const nameVal = document.getElementById('cfg-name').value.trim();
    const ipVal = document.getElementById('cfg-ip').value.trim();
    const maskVal = document.getElementById('cfg-mask').value.trim();

    if (!nameVal) { alert("Device Name is required"); return; }
    if (ipVal && !isValidIP(ipVal)) { alert("Invalid IP Address format"); return; }
    if (maskVal && !isValidIP(maskVal)) { alert("Invalid Subnet Mask format"); return; }

    diagram.startTransaction("update config");
    try {
        diagram.model.setDataProperty(node.data, "name", nameVal);
        diagram.model.setDataProperty(node.data, "ip", ipVal);
        diagram.model.setDataProperty(node.data, "mask", maskVal);

        const category = document.getElementById('cfg-device-type').value;
        if (['PC', 'Laptop', 'Server', 'Printer'].includes(category)) {
            const gwVal = document.getElementById('cfg-gateway').value.trim();
            if(gwVal && !isValidIP(gwVal)) { diagram.rollbackTransaction(); alert("Invalid Gateway IP"); return; }
            diagram.model.setDataProperty(node.data, "gateway", gwVal);
        }
        if (category === 'Router') {
            const rows = document.querySelectorAll('#routingTableBody tr');
            const newRoutes = [];
            let routeErr = false;
            rows.forEach(tr => {
                const dest = tr.querySelector('.tbl-input-dest').value.trim();
                const hop = tr.querySelector('.tbl-input-hop').value.trim();
                if(dest && hop) {
                    if(!isValidIP(dest) || !isValidIP(hop)) routeErr = true;
                    newRoutes.push({ dest: dest, nextHop: hop });
                }
            });
            if(routeErr) { diagram.rollbackTransaction(); alert("Invalid IP in Routing Table."); return; }
            diagram.model.setDataProperty(node.data, "routingTable", newRoutes);
        }
        diagram.commitTransaction("update config");
        document.getElementById('configModal').style.display = 'none';
        updateStatus(`Configuration saved for ${nameVal}`);
    } catch (e) {
        diagram.rollbackTransaction();
        alert("Failed to save changes.");
    }
}


function startTracerouteMode() {
    if(!diagram) return;
    isSimulationMode = true;
    simType = 'manual';
    simStep = 1;
    simSourceNode = null;
    diagram.clearHighlighteds();
    updateStatus("TRACEROUTE: Select SOURCE device.");
}

function handleManualSelection(node) {
    
    if(['Switch', 'Cloud', 'AccessPoint'].includes(node.data.category)) return;

    if (simStep === 1) {
        simSourceNode = node;
        node.isHighlighted = true; 
        simStep = 2;
        updateStatus(`Source: ${node.data.name}. Select DESTINATION.`);
        return;
    }

    if (simStep === 2) {
        
        updateStatus("Calculating Path...");
        runSingleSimulation(simSourceNode, node);
        
        
        isSimulationMode = false; simStep = 0; simSourceNode = null;
    }
}

function runSingleSimulation(source, dest) {
    
    if (source === dest) {
        showPopup(true, "Loopback", "Packet successfully pinged self.", 0);
        return;
    }

    const result = runRoutingSimulation(source, dest);
    
    if (result.path && result.path.nodes.length > 0) {
        highlightPath(result.path);
        
        animatePacket(result.path, result.success, () => {
            if (result.success) {
                showPopup(true, result.type, result.message, result.hops);
                updateStatus("Trace Successful.");
                if(window.recordSimulationSuccess) window.recordSimulationSuccess();
            } else {
                showPopup(false, "Packet Dropped", result.message, result.hops || 0);
                updateStatus("Trace Failed: " + result.message);
            }
        });
    } else {
        showPopup(false, "No Path", result.message, 0);
        updateStatus("Trace Failed.");
    }
}


function startRealtimeSim() {
    if(!diagram) return;

    
    if(activeRealtimeSims > 0) {
        updateStatus("Wait for current simulation to finish...");
        return;
    }

    diagram.clearHighlighteds();
    updateStatus("REALTIME: Initializing Network Connectivity Test...");

    
    const endDevices = [];
    diagram.nodes.each(n => {
        if(['PC','Laptop','Server','Printer'].includes(n.data.category)) {
            endDevices.push(n);
        }
    });

    if(endDevices.length < 2) {
        updateStatus("REALTIME: Need at least 2 connected end devices to simulate.");
        showRealtimeSummaryBox(0, 0, 0); 
        return;
    }

    
    activeRealtimeSims = 0;
    realtimeSuccessCount = 0;
    realtimeFailCount = 0;
    realtimeTotalScheduled = 0;

    
    endDevices.forEach((src, index) => {
        
        
        if(src.data.gateway) {
            const gwNode = findNodeByIP(src.data.gateway);
            realtimeTotalScheduled++;
            
            if(gwNode) {
                schedulePacket(src, gwNode, index * 400); 
            } else {
                
                scheduleImmediateFail(src, "Gateway IP not found", index * 400);
            }
        }

       
        const targets = endDevices.filter(d => d !== src);
        if(targets.length > 0) {
            const dest = targets[Math.floor(Math.random() * targets.length)];
            realtimeTotalScheduled++;
            schedulePacket(src, dest, (index * 400) + 200); 
        }
    });

    if(realtimeTotalScheduled === 0) {
        updateStatus("REALTIME: No valid targets found.");
        showRealtimeSummaryBox(0, 0, 0);
    } else {
        updateStatus(`REALTIME: Traffic generated. Visualizing ${realtimeTotalScheduled} packets...`);
    }
}

function schedulePacket(src, dest, delay) {
    activeRealtimeSims++;
    setTimeout(() => {
        const res = runRoutingSimulation(src, dest);
        if(res.path && res.path.nodes.length > 0) {
            animatePacket(res.path, res.success, () => {
                
                activeRealtimeSims--;
                if(res.success) realtimeSuccessCount++;
                else realtimeFailCount++;
                
                checkRealtimeCompletion();
            });
        } else {
            
            activeRealtimeSims--;
            realtimeFailCount++;
            checkRealtimeCompletion();
        }
    }, delay);
}

function scheduleImmediateFail(src, msg, delay) {
    activeRealtimeSims++;
    setTimeout(() => {
       
        const xMark = $(go.Part, 
            { locationSpot: go.Spot.Center, layerName: "Foreground", zOrder: 101 },
            $(go.TextBlock, "❌", { font: "20px Arial", stroke: "red" })
        );
        xMark.location = src.location;
        diagram.add(xMark);
        
        
        setTimeout(() => diagram.remove(xMark), 1000);

       
        activeRealtimeSims--;
        realtimeFailCount++;
        console.log(`Packet failed: ${msg} at ${src.data.name}`);
        
        checkRealtimeCompletion();
    }, delay);
}

function checkRealtimeCompletion() {
   
    if(activeRealtimeSims <= 0) {
        activeRealtimeSims = 0; 
        
        
        showRealtimeSummaryBox(realtimeTotalScheduled, realtimeSuccessCount, realtimeFailCount);

       
        if(realtimeSuccessCount > 0 && window.recordSimulationSuccess) {
            window.recordSimulationSuccess();
        }
        updateStatus("REALTIME: Simulation Complete.");
    }
}


function ipToLong(ip) { 
    if(!ip) return 0; 
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0; 
}

function isSameSubnet(ip1, ip2, mask) { 
    if(!ip1 || !ip2 || !mask) return false; 
    const m = ipToLong(mask); 
    return (ipToLong(ip1) & m) === (ipToLong(ip2) & m); 
}


function isIpInSubnet(targetIp, networkIp, mask) { 
    const target = ipToLong(targetIp);
    const net = ipToLong(networkIp);
    const m = ipToLong(mask);
    return (target & m) === (net & m);
}


function getImpliedMask(ip) {
    const firstOctet = parseInt(ip.split('.')[0]);
    if (firstOctet >= 1 && firstOctet <= 126) return "255.0.0.0";   
    if (firstOctet >= 128 && firstOctet <= 191) return "255.255.0.0"; 
    if (firstOctet >= 192 && firstOctet <= 223) return "255.255.255.0"; 
    return "255.255.255.0"; 
}


function runRoutingSimulation(source, dest) {
    let pathNodes = [source];
    let pathLinks = [];
    let currentNode = source;
    let hops = 0;
    const maxHops = 15;
    let destIP = dest.data.ip;

    while(hops < maxHops) {
        if (currentNode === dest) return { success: true, message: "Destination Reached.", path: { nodes: pathNodes, links: pathLinks }, hops: hops, type: "Success" };

        let currentIP = currentNode.data.ip;
        let currentMask = currentNode.data.mask;
        let nextHopIP = null;
        let l2Path = findPhysicalPath(currentNode, dest);
        let isDirectlyConnected = false;

        
        if (isSameSubnet(currentIP, destIP, currentMask)) isDirectlyConnected = true;
        
        else if (currentNode.data.category === 'Router' && l2Path) isDirectlyConnected = true;

        if (isDirectlyConnected) {
            if (l2Path) {
                pathNodes = pathNodes.concat(l2Path.nodes.slice(1));
                pathLinks = pathLinks.concat(l2Path.links);
                return { success: true, message: "Delivered via Local Segment.", path: { nodes: pathNodes, links: pathLinks }, hops: hops, type: "Success" };
            } else {
                return { success: false, message: `Destination ${destIP} is logical neighbor but not reachable physically (Check cables).`, path: { nodes: pathNodes, links: pathLinks }, hops: hops };
            }
        }

        
        if (['PC', 'Laptop', 'Server', 'Printer'].includes(currentNode.data.category)) {
            if (!currentNode.data.gateway) return { success: false, message: `No Default Gateway on ${currentNode.data.name}.`, path: { nodes: pathNodes, links: pathLinks }, hops: hops };
            nextHopIP = currentNode.data.gateway;
        } 
        else if (currentNode.data.category === 'Router') {
            const routes = currentNode.data.routingTable || [];
            let bestRoute = null;
            let bestMatchLength = -1;

            
            for (let route of routes) {
                
                let impliedMask = getImpliedMask(route.dest);
                
                if (isIpInSubnet(destIP, route.dest, impliedMask)) {
                    
                    let matchLen = ipToLong(impliedMask); 
                    if (matchLen > bestMatchLength) {
                        bestMatchLength = matchLen;
                        bestRoute = route;
                    }
                }
            }
            
            if (bestRoute) {
                nextHopIP = bestRoute.nextHop;
            } else {
                return { success: false, message: `Router ${currentNode.data.name} has no route to network containing ${destIP}.`, path: { nodes: pathNodes, links: pathLinks }, hops: hops };
            }
        }

        if (!nextHopIP) return { success: false, message: "No Next Hop identified.", path: { nodes: pathNodes, links: pathLinks }, hops: hops };

        
        let nextHopNode = findNodeByIP(nextHopIP);
        if (!nextHopNode) return { success: false, message: `Next Hop IP ${nextHopIP} is not active in the network.`, path: { nodes: pathNodes, links: pathLinks }, hops: hops };

        let pathToHop = findPhysicalPath(currentNode, nextHopNode);
        if (!pathToHop) return { success: false, message: `Cannot physically reach Next Hop ${nextHopIP} (Check cabling).`, path: { nodes: pathNodes, links: pathLinks }, hops: hops };

        pathNodes = pathNodes.concat(pathToHop.nodes.slice(1));
        pathLinks = pathLinks.concat(pathToHop.links);
        currentNode = nextHopNode;
        hops++;
    }
    return { success: false, message: "TTL Exceeded.", path: { nodes: pathNodes, links: pathLinks }, hops: hops };
}

function findPhysicalPath(startNode, endNode) {
    let queue = [{ curr: startNode, path: [startNode], links: [] }];
    let visited = new Set([startNode.data.key]);
    while (queue.length > 0) {
        let { curr, path, links } = queue.shift();
        if (curr === endNode) return { nodes: path, links: links };
        let it = curr.findLinksConnected();
        while (it.next()) {
            let link = it.value;
            let neighbor = link.getOtherNode(curr);
            let isL2 = ['Switch', 'AccessPoint', 'Cloud', 'Hub'].includes(neighbor.data.category);
            let isTarget = (neighbor === endNode);
            if (!visited.has(neighbor.data.key)) {
                if (isL2 || isTarget) {
                    visited.add(neighbor.data.key);
                    queue.push({ curr: neighbor, path: [...path, neighbor], links: [...links, link] });
                }
            }
        }
    }
    return null;
}

function findNodeByIP(ipAddr) {
    let target = null;
    diagram.nodes.each(n => { if (n.data.ip === ipAddr) target = n; });
    return target;
}

function highlightPath(data) {
    diagram.startTransaction("h");
    if(data.links) data.links.forEach(l => l.isHighlighted = true);
    if(data.nodes) data.nodes.forEach(n => n.isHighlighted = true);
    diagram.commitTransaction("h");
}

function animatePacket(data, isSuccess, onFinish) {
    if(!data.nodes || data.nodes.length < 2) { if(onFinish) onFinish(); return; }
    
    
    const packet = $(go.Part, 
        { 
            locationSpot: go.Spot.Center, 
            layerName: "Foreground", 
            zOrder: 100 
        }, 
        $(go.Panel, "Auto",
            $(go.Shape, "Circle", { width: 14, height: 14, fill: "rgba(250, 204, 21, 0.9)", stroke: "#fff", strokeWidth: 1 }),
            $(go.Shape, "Circle", { width: 4, height: 4, fill: "#fff", strokeWidth: 0 })
        )
    );
    
    diagram.add(packet);
    packet.location = data.nodes[0].location;

    let i = 0;
    
    function next() {
        if(i >= data.nodes.length - 1) { 
            
            if(!isSuccess) {
                
                const xMark = $(go.Part, 
                    { locationSpot: go.Spot.Center, layerName: "Foreground" },
                    $(go.TextBlock, "❌", { font: "18px Arial", stroke: "red" })
                );
                xMark.location = data.nodes[i].location;
                diagram.add(xMark);
                diagram.remove(packet);
                setTimeout(() => diagram.remove(xMark), 1500);
            } else {
                
                diagram.remove(packet);
            }
            if(onFinish) onFinish();
            return; 
        }

        const anim = new go.Animation();
        anim.add(packet, "location", data.nodes[i].location, data.nodes[i+1].location);
        anim.duration = 800; 
        anim.runCount = 1;
        anim.finished = () => { i++; next(); };
        anim.start();
    }
    next();
}

function updateStatus(msg) {
    const el = document.getElementById("simulationMessage");
    if(el) { el.innerText = msg; el.style.color = "var(--neon-blue)"; }
}


function showPopup(success, type, msgText, hops) {
    const old = document.getElementById("simResultModal");
    if(old) old.remove();
    const color = success ? "#10b981" : "#ef4444";
    const icon = success ? "fa-check-circle" : "fa-times-circle";
    const html = `
    <div id="simResultModal" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); 
         background: #1e293b; border: 2px solid ${color}; padding: 30px; border-radius: 12px; 
         box-shadow: 0 0 50px rgba(0,0,0,0.8); z-index: 10001; width: 400px; text-align: center; color: white;">
        <i class="fas ${icon}" style="font-size: 3rem; color: ${color}; margin-bottom: 15px;"></i>
        <h2 style="margin-bottom: 10px;">${success ? "SUCCESS" : "FAILED"}</h2>
        <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: left;">
            <p><strong>Type:</strong> ${type}</p>
            <p><strong>Hops:</strong> ${hops}</p>
            <p style="margin-top:5px; color:#cbd5e1; font-size: 0.9rem;">${msgText}</p>
        </div>
        <button onclick="document.getElementById('simResultModal').remove()" 
            style="background: ${color}; color: #0f172a; border: none; padding: 10px 20px; 
            font-weight: bold; cursor: pointer; border-radius: 6px; width: 100%;">CLOSE</button>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}


function showRealtimeSummaryBox(total, success, failed) {
    const old = document.getElementById("simSummaryModal");
    if(old) old.remove();
    
    
    let color = "#10b981"; 
    let title = "SIMULATION COMPLETE";
    
    if(total === 0) {
        color = "#64748b"; 
        title = "NO TRAFFIC GENERATED";
    } else if (failed > 0 && success > 0) {
        color = "#f59e0b"; 
        title = "PARTIAL SUCCESS";
    } else if (success === 0 && total > 0) {
        color = "#ef4444"; 
        title = "NETWORK FAILURE";
    }

    const html = `
    <div id="simSummaryModal" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); 
         background: #1e293b; border: 2px solid ${color}; padding: 30px; border-radius: 12px; 
         box-shadow: 0 0 50px rgba(0,0,0,0.9); z-index: 10002; width: 420px; text-align: center; color: white;">
        
        <h2 style="margin-bottom: 20px; color: ${color}; text-transform: uppercase;">${title}</h2>
        
        <div style="display:flex; justify-content:space-between; margin-bottom:20px; gap:10px;">
            <div style="flex:1; background:rgba(0,0,0,0.3); padding:15px; border-radius:8px;">
                <h1 style="color:#38bdf8; font-size:2rem; margin:0;">${total}</h1>
                <span style="font-size:0.8rem; color:#94a3b8;">SENT</span>
            </div>
            <div style="flex:1; background:rgba(0,0,0,0.3); padding:15px; border-radius:8px;">
                <h1 style="color:#10b981; font-size:2rem; margin:0;">${success}</h1>
                <span style="font-size:0.8rem; color:#94a3b8;">SUCCESS</span>
            </div>
            <div style="flex:1; background:rgba(0,0,0,0.3); padding:15px; border-radius:8px;">
                <h1 style="color:#ef4444; font-size:2rem; margin:0;">${failed}</h1>
                <span style="font-size:0.8rem; color:#94a3b8;">FAILED</span>
            </div>
        </div>

        <p style="color:#cbd5e1; font-size:0.9rem; margin-bottom:20px;">
            ${failed === 0 && total > 0 ? "Perfect connectivity! Network is fully operational." : ""}
            ${failed > 0 ? "Some packets were dropped. Check Gateway configurations or Routing Tables." : ""}
            ${total === 0 ? "Connect at least 2 End Devices to start." : ""}
        </p>

        <button onclick="document.getElementById('simSummaryModal').remove()" 
            style="background: ${color}; color: #0f172a; border: none; padding: 12px 20px; 
            font-weight: bold; cursor: pointer; border-radius: 6px; width: 100%;">ACKNOWLEDGE</button>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', html);
}

function getDiagramJSON() { if (!diagram) return null; return diagram.model.toJson(); }
function loadDiagramModel(json) { 
    if (diagram && json) {
        diagram.model = go.Model.fromJson(json);
        isSimulationMode = false; simStep = 0;
    }
}