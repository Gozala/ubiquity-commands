var noun_type_connection = {
    
    _name: "mozrepl connection",
    
    readAllFromSocket : function (host,port,outputData,listener) {
        try {
            var transportService = Components.classes["@mozilla.org/network/socket-transport-service;1"].getService(Components.interfaces.nsISocketTransportService);
            var transport = transportService.createTransport(null,0,host,port,null);
            
            var outstream = transport.openOutputStream(0,0,0);
            outstream.write(outputData,outputData.length);

            var stream = transport.openInputStream(0,0,0);
            var instream = Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance(Components.interfaces.nsIScriptableInputStream);
            instream.init(stream);

            var dataListener = {
                data : "",
                onStartRequest: function(request, context){},
                onStopRequest: function(request, context, status){
                    instream.close();
                    outstream.close();
                    listener.finished(this.data);
                },
                onDataAvailable: function(request, context, inputStream, offset, count){
                    this.data += instream.read(count);
                }
            };

            var pump = Components.classes["@mozilla.org/network/input-stream-pump;1"].createInstance(Components.interfaces.nsIInputStreamPump);
            pump.init(stream, -1, -1, 0, 0, false);
            pump.asyncRead(dataListener,null);
        } catch (ex){
            return ex;
        }
        return null;
    },
    
    get openConnections() {
        return Application.storage.get('ubiquity-repl-openConnections',[]);
    },
    
    get recentConnections() {
        return Application.prefs.get('ubiquity.commands.repl.recentConnections','localhost:4242').split('|');
    },
    
    suggest : function(text, html) {
        var suggestions = [];
        
        if (!noun_type_jira.baseJiraURL) {
            var message = 'Set JIRA url to : '+text;
            suggestions.push({
                text : message,
                html : '<img src="'+noun_type_jira.iconJiraURL+'" alt="" width="16px"/> '+message,
                summary: '<span style="color: red">You need to set jira url</span>',
                data : {
                    action : function () {
                        noun_type_jira.baseJiraURL = text.substr(-1)=="/"?text:text+"/";
                    }
                }
            });
        } else {
            var findMessage = 'Find in JIRA';
            suggestions.push({
                text : findMessage,
                html : '<img src="'+noun_type_jira.iconJiraURL+'" alt="" width="16px"/> '+findMessage+' : '+text,
                summary: findMessage,
                data : {
                    action : function () {
                        window.getBrowser().selectedTab = window.getBrowser().addTab(noun_type_jira.searchJiraURL+text);
                    }
                }
            });
            
            var createMessage = 'Create new issue';
            suggestions.push({
                text : createMessage,
                html : '<img src="'+noun_type_jira.iconJiraURL+'" alt="" width="16px"/> '+createMessage,
                summary: createMessage,
                data : {
                    action : function () {
                        window.getBrowser().selectedTab = window.getBrowser().addTab(noun_type_jira.createJiraURL);
                    }
                }
            });
        }
        
        if (!noun_type_jira.baseCrucibleURL) {
            message = 'Set Crucible url to : '+text;
            suggestions.push({
                text : message,
                html : '<img src="'+noun_type_jira.iconCrucibleURL+'" alt="" width="16px"/> '+message,
                summary: '<span style="color: red">You need to set Crusible url</span>',
                data : {
                    action : function() {
                        noun_type_jira.baseCrucibleURL = text.substr(-1)=="/"?text:text+"/";
                    }
                }
            });
        } else {
            var findMessage = 'Find in Crucible';
            suggestions.push({
                text : findMessage,
                html : '<img src="'+noun_type_jira.iconCrucibleURL+'" alt="" width="16px"/> '+findMessage+' : <b>'+text+'</b>',
                summary: findMessage,
                data : {
                    action : function() {
                        window.getBrowser().selectedTab = window.getBrowser().addTab(noun_type_jira.searchCrucibleURL+text);
                    }
                }
            });
            
            var createMessage = 'Create new review';
            suggestions.push({
                text : createMessage,
                html : '<img src="'+noun_type_jira.iconCrucibleURL+'" alt="" width="16px"/> '+createMessage,
                summary: createMessage,
                data : {
                    action : function() {
                        window.getBrowser().selectedTab = window.getBrowser().addTab(noun_type_jira.createCrucibleURL);
                    }
                }
            });
        }
        
        return suggestions;
    }
};

var noun_type_mozreplAction = new CmdUtils.NounType("mozrepl actions",['eval','inspect','enter']);

var connection = null;

var MozReplClient = {
    eval : function(expression) {
        return window.eval(expression);
    }
}

CmdUtils.CreateCommand({
    name: 'repl',
    icon: 'http://hyperstruct.net/sites/hyperstruct.net/files/zen-hyperstruct_favicon.png',
    description: 'mozrepl clinet build in Ubiquity',
    author: { name: "Irakli Gozalishvili", email: "Irakli.Gozalishvili@tomtom.com"},
    homepage: 'http://rfobic.blogspot.com/2008/10/ubiquity-MozRepl.html',
    help: 'Type everything the way if it was a console and soon you\'ll discover diff!!',
    takes: {
        'expression' : noun_arb_text
    },
    
    modifiers: {
        'do' : noun_type_mozreplAction
    },
    
    
    preview: function(pblock, expression, mods) {
        var connection = 1;
        var action = mods.do.text || eval
        if (connection) {
            switch (action) {
                case 'inspect':
                    var description = 'MozRepl will inspect :';
                    break;
                case 'enter' :
                    var description = 'MozRepl will enter :';
                    break;
                default:
                    var description = 'MozRepl will evaluate :';
            }
            pblock.innerHTML = '<i>'+description+'</i><br/><br/><code style="white-space: pre;">'+expression.text+'</code>';
        } else {
            pblock.innerHTML = '<span style="color: red">Please use repl-connect first</span>';
        }
    },

    execute: function(expression,mods) {
        var action = mods.do.text || eval
        switch (action) {
            case 'inspect':
                displayMessage(MozReplClient.eval(expression.text).toSource());
                break;
            case 'enter' :
                var description = 'MozRepl will enter :';
                break;
            default:
                displayMessage(MozReplClient.eval(expression.text).toString());
        }
    }
});