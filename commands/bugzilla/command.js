var CC = Components.Constructor;
var LoginManager = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);
var LoginInfo = new CC("@mozilla.org/login-manager/loginInfo;1",Ci.nsILoginInfo,"init");
var $ = jQuery;
var Prefs = Application.prefs;
var notify = function(message) {
    displayMessage({
        title : message.title || '',
        text : message.text || message,
        icon : Template.icon
    });
};

/**
 * Mutates noun to the adjective
 * Adds dependency resolver
 * Adds suggestion history cache
 * Adds delay support for suggestions
 */
CmdUtils.CreateAdjective = function CreateAdjective (noun) {
    /**
     * Checks all the dependencies and returns true if all of them are satisfied
     * @returns {boolean}
     */
    noun.__defineGetter__('reliable', function relible(){
        for each (var dependency in this.dependencies)
            if (!dependency.reliable) return false
        return true;
    }),
    /**
     * Delay which will happen before parser will satrt parseing input
     * If input will change before suggestions will be canceled
     * @type Integer number of miliseconds
     */
    noun.delay = noun.delay || 0;
    /**
     * Length length
     */
    noun.memory = noun.memory || 10;
    /**
     * This property is used to store timer id for the delayed suggestions
     * @type {string}
     */
    noun._timerId = null;
    /**
     * Saving original suggest in order to be able to use it after mutation
     */
    noun._suggest = noun.suggest;
    /**
     * returns suggestions
     */
    noun.suggest = function suggest() {
        if (this.reliable) {
            Utils.clearTimeout(this._timerId);
            var args = arguments;
            if (this.delay == 0)
                return noun._suggest.apply(this, args);
            // If mutate
            this._timerId = Utils.setTimeout(function(){
                noun._suggest.apply(noun, args);
            }, this.delay);
            
            // Workaround for async suggestions bug
            // https://bugzilla.mozilla.org/show_bug.cgi?id=484615
            return [{
                text : 'BUG 484615',
                summary : 'Workaround for bug 484615',
                html : '<a href="https://bugzilla.mozilla.org/show_bug.cgi?id=484615">BUG 484615</a>',
                data : {summary:(new String("Ubiquity Asynchronous Noun Suggestions are not working")), internals:{cf_blocking_fennec:(new String("---")), priority:(new String("--")), bug_id:(new Number(484615)), _multi_selects:[], bug_file_loc:(new String("http://groups.google.com/group/ubiquity-firefox/browse_thread/thread/d556c431e40ff9aa")), cclist_accessible:(new Number(1)), rep_platform:(new String("x86")), product_id:(new Number(40)), creation_ts:(new String("2009.03.21 17:46")), assigned_to:(new Number(298253)), short_desc:(new String("Ubiquity Asynchronous Noun Suggestions are not working")), qa_contact:(new Number(247525)), everconfirmed:(new Number(0)), status_whiteboard:(new String("")), bug_severity:(new String("major")), bug_status:(new String("UNCONFIRMED")), delta_ts:(new String("2009-03-21 17:46:06")), version:(new String("unspecified")), reporter_id:(new Number(295373)), component_id:(new Number(757)), resolution:(new String("")), reporter_accessible:(new Number(1)), target_milestone:(new String("--")), alias:{}, op_sys:(new String("Mac OS X"))}, id:(new Number(484615)), last_change_time:(new Date(1240328766122)), creation_time:(new Date(1240328760122)), alias:(new String(""))}
            }];
        }
        return [];
    };
    /**
     * Saving original default in order to be able to use it after mutation
     */
    noun._default = noun.default;
    /**
     * Proxy function for noun default that is enabled only in case if noun has default
     * Used to prevent any actions if object is not reliable 
     * @returns {Array}
     */
    noun.default = !noun.default ? noun.default : function() {
        if (this.reliable) {
            return this._default.apply(this, arguments);
        }
        else
            return [];
    };
    /**
     * If true suggestion data will be cached.
     */
    noun.cache = noun.cache || false;
    /**
     * History of suggestion
     */
    noun.history = function history(limit, callback, self) {
        self = self || arguments.callee.caller;
        var suggestions = [];
        try {
            suggestions = Utils.decodeJson(Application.prefs.getValue('ubiquity.adjectives.' + this._name + '.history', '[]')).slice(0, limit);
        } catch(e) {}
        
        if (this.cache) {
            if (callback)
                suggestions.forEach(function(suggestion) {
                    callback.call(self, suggestion);
                });
        } else {
            if (callback)
                suggestions.forEach(function(suggestion) {
                    this.suggest(suggestion.text, suggestion.html, function(data) {
                        callback.call(self, data);
                    });
                }, this);
            else
                return suggestions.map(function(suggestion) {
                    return this.suggest(suggestion.text, suggestion.html)[0];
                }, this);
        }
        return suggestions;
    };
    /**
     * Adds suggestion to the history
     */
    noun.addHistory = function addHistory(suggestion) {
        if (suggestion && suggestion.text) {
            try {
                var suggestions = Utils.decodeJson(Application.prefs.getValue('ubiquity.adjectives.' + this._name + '.history', '[]')).filter(function(element){
                    return (element.text != suggestion.text);
                }).slice(0, this.memory - 1);
                suggestions.unshift(suggestion);
                Application.prefs.setValue('ubiquity.adjectives.' + this._name + '.history', Utils.encodeJson(suggestions));
            } catch (e) {}
        }
    };
    /**
     * Removes suggestion from history
     */
    noun.removeHistory = function removeHistory(suggestion) {
        if (suggestion) {
            try {
                var suggestions = Utils.decodeJson(Application.prefs.getValue('ubiquity.adjectives.' + this._name + '.history', '[]')).filter(function(element){
                    return (element.text != suggestion.text);
                });
                Application.prefs.setValue('ubiquity.adjectives.' + this._name + '.history', Utils.encodeJson(suggestions));
            } catch(e) {}
        }
    };
    
    return noun;
};

var Rpc2jsonError = function(error) {
    this.causedBy = error;
}
Rpc2jsonError.prototype.__proto__ = Error.prototype;

var Json2rpcError = function(error) {
    this.causedBy = error;
};
Json2rpcError.prototype.__proto__ = Error.prototype;

RpcFault = function(error) {
    this.causedBy = error;
}
RpcFault.prototype.__proto__ = Error.prototype;

var IgnorableError = function(error) {
    this.causedBy = error;
}
IgnorableError.prototype.__proto__ = Error.prototype;

/**
 * Makes rpc calls to the JIRA XML-RPC Service and returns results as XML
 * Example:
 * rpc('http://jira.atlassian.com/rpc/xmlrpc','jira1.login',
 *      <params>
 *          <param>
 *              <value>{user}</value>
 *           </param>
 *           <param>
 *              <value>{password}</value>
 *           </param>
 *      </params>);
 * 
 * 
 * @param url {String} XML-RPC Service url
 * @param method {String} Name of the method to be called
 * @param data {XML} Data to be passed to the Remote Procedure
 * 
 * @throws Error {Error} Throw exceprion if method responce contains fault
 */
var rpc = function rpc(url, method, data, callbak) {
    try {
        var async = callbak ? true : false;
        var request = {
            url : url,
            type : 'POST',
            data :  <methodCall>
                        <methodName>{method}</methodName>
                        {json2rpc(data)}
                    </methodCall>.toXMLString(),
            async : async,
            contentType : 'text/xml',
            dataType : 'text'
        };
        
        if (async) {
            request.success = function requestSuccess(data, textStatus) {
                var responce = rpc2json(new XML(data.replace(/^<\?xml\s+version\s*=\s*(["'])[^\1]+\1[^?]*\?>/,"")));
                if (responce.fault) {
                    notify({
                        title : Locale.errors.rpcFault,
                        text : responce.fault.faultString.toString()
                    });
                } else
                    callbak(responce);
            };
            request.error = function requestFailed(xhr, textStatus, errorThrown) {
                notify('Have no clue if its going to be catched somewhere');
                throw new RpcFault(errorThrown);
            };
            return $.ajax(request);
        } else {
            var responce = rpc2json(new XML($.ajax(request).responseText.replace(/^<\?xml\s+version\s*=\s*(["'])[^\1]+\1[^?]*\?>/,"")));
            if (responce.fault)
                throw new RpcFault(responce);
            else
                return responce;
        }
    } catch (e if e instanceof Json2rpcError) {
        notify({
            title : Locale.errors.json2rpcError,
            text : e.causedBy.message
        });
        Logger.log(e.causedBy);
        throw new IgnorableError(e);
    } catch (e if e instanceof Rpc2jsonError) {
        notify({
            title : Locale.errors.rpc2jsonError,
            text : e.causedBy.message
        });
        Logger.log(e.causedBy);
        throw new IgnorableError(e);
    } catch (e if e instanceof RpcFault) {
        notify({
            title : Locale.errors.rpcFault,
            text : responce.fault.faultString.toString()
        });
        throw new IgnorableError(e);
    } catch (e) {
        notify({
            title : Locale.errors.serverCallError,
            text : e.message
        });
        Logger.log(e);
        throw new IgnorableError(e);
    }
};

/**
 * Recursive function converts responce of the RPC
 * call to the JSON Object
 * @returns {Object} JSON type object
 */
var rpc2json = function rpc2json(xml) {
    try {
        var data = {};
        for each (var member in xml.*) {
            if (member.nodeKind() == 'text')
                return new String(member);
            
            switch (member.name().toString()) {
                case 'i4' :
                case 'int' :
                case 'double' :
                    return new Number(member.text());
                    break;
                case 'string' :
                    return new String(member.text());
                    break;
                case 'dateTime.iso8601' :
                    var [ ,year, month, date, hours, minutes, seconds] = member.text().match(/^(\d{4})(\d{2})(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
                    var dateTime = new Date();
                    dateTime.setFullYear(year);
                    dateTime.setMonth(month);
                    dateTime.setDate(date);
                    dateTime.setHours(hours);
                    dateTime.setMinutes(minutes);
                    dateTime.setSeconds(seconds);
                    return dateTime;
                    break;
                case 'base64' :
                    return member.text();
                    break;
                case 'value' :
                case 'struct' :
                case 'methodResponse' :
                    return rpc2json(member);
                    break;
                case 'member' :
                    data[member.name.text()] = rpc2json(member.value);
                    break;
                case 'fault' :
                case 'params' :
                case 'param' :
                    data[member.name().toString()] = rpc2json(member);
                    break;
                case 'array' :
                    var tempArray = [];
                    for each (value in member.data.value) {
                        tempArray.push(rpc2json(value));
                    }
                    return tempArray;
                    break;
                default :
                    return null;
            }
        }
        return data;
    } catch(e) {
        throw new Rpc2jsonError(e);
    }
};

/**
 * Recursive function converts JSON type object to RPC method call like xml
 * @returns {XML} E4X object
 */
var json2rpc = function json2rpc(json) {
    try {
        if (!json) return <params/>
        switch (typeof json) {
            case 'boolean':
                return <boolean>{((json) ? '1' : '0')}</boolean>;
            case 'number':
                return (parseInt(json) == json) ? <int>{json}</int> : <double>{json}</double>;
            case 'string':
                return <string>{json}</string>;
            case 'object':
                if (json instanceof String)
                    return <string>{json}</string>;
                else if (json instanceof Date)
                    return <dateTime.iso8601>{json.getFullYear() + json.getMonth() + json.getDate() + 'T' + json.getHours() + ':' + json.getMinutes() + ':' + json.getSeconds()}</dateTime.iso8601>;
                else if (json instanceof Array) {
                    if (json2rpc == arguments.callee.caller) {
                        var tempArray = <array><data/></array>;
                        for each(member in json)
                            tempArray.data.appendChild(<value>{json2rpc(member)}</value>);
                        return tempArray;
                    } else {
                        result = <params/>
                        for each(member in json)
                            result.appendChild(<param><value>{json2rpc(member)}</value></param>);
                        return result;
                    }
                } else {
                    var struct = <struct/>;
                    for (key in json)
                        struct.appendChild(
                            <member>
                                <name>{key}</name>
                                <value>{json2rpc(json[key])}</value>
                            </member>
                        );
                    return struct;
                }
            break;
        }
    } catch (e) {
        throw new Json2rpcError(e);
    }
    return null;
};

var Logger = {
    log : function(message) {
        if (message instanceof Error || message.stack) {
            this.log(message.stack);
            this.log(message.toSource())
        } else
            dump('ubiquity.command.bugzilla> ' + message.toSource() + '\n');
    }
};

var Locale = {
    errors : {
        unknown : 'Unknown error occured',
        wrongURL : 'Error occured \nMight be incorrect XML-RPC URL was specified',
        json2rpcError : 'Error occured during server request generation',
        rpc2jsonError : 'Error occured during parsing server response',
        serverCallError : 'Error occured during server call, most likely wrong bugzilla url was specified (check connection urls)',
        rpcFault : 'RPC Call returned fault'
    },
    
    info_version : {
        title : 'Bugzilla information : ',
        version : 'Version : '
    },
    
    user : {
        title : 'User information : ',
        label : ''
    },
    
    connection : {
        add : 'Connection has been added',
        remove : 'Connection has been removed',
        missing : 'No connections found',
        mandatory : 'In order to use bugzilla commands you need to add at least one connection'
    },
    
    bug : {
        get : {
            description : 'Gets information about particular bugs in the database.',
            title : 'Bug - ',
            cf_blocking_fennec : '@cf_blocking_fennec',
            priority : 'Priority',
            bug_id : 'Bug ID',
            _multi_selects: '@multi_selects',
            bug_file_loc: 'URL',
            cclist_accessible: '@cclist_accessible',
            rep_platform: 'Platform',
            product_id: '@Product (need text not id)',
            creation_ts: 'Reported',
            assigned_to: '@Assigned to',
            short_desc: 'Description',
            qa_contact: '@qa_contact',
            everconfirmed: '@everconfirmed',
            status_whiteboard: 'Whiteboard',
            bug_severity: 'Importance',
            bug_status: 'Status',
            delta_ts: '@delta_ts',
            version: 'Version',
            reporter_id: '@reporter_id (need reporter)',
            component_id: '@component_id (need Component)',
            resolution: 'Resolution',
            reporter_accessible: '@reporter_accessible',
            target_milestone: 'Target Milestone',
            alias: 'Alias',
            op_sys: 'OS',
            id: 'ID',
            last_change_time: 'Modified',
            creation_time: 'Reported'
        }
    }
};

var Confs = {
    splitter : '|',
    names : {
        connections : 'ubiquity.commands.bugzilla.connections',
        url : 'ubiquity.commands.bugzilla.url.',
        lastConnection : 'ubiquity.commands.bugzilla.lastConnection',
        lastBug : 'ubiquity.commands.bugzilla.lastBug'
    }
};

var Template = {
    icon : 'http://www.bugzilla.org/img/buggie.png',
    style :
        <style>
            {'.fixed {text-decoration: line-through;}'}
            {'a {text-decoration: underline;}'}
        </style>,
    loader :
        <span>
            {'Loading... '}
            <img id="loader" src="chrome://global/skin/icons/loading_16.png" alt=""/>
        </span>,
    needConnection :
        <div>
            <h2 id="title">
                {Locale.connection.missing}
                <span class="important">
                    {Locale.connection.mandatory}
                </span>
            </h2>
        </div>,
    span : function(data) {
        if (data) {
            if (data instanceof Array) {
                text = '';
                for each (var part in data)
                    text += part && part != '' ? ' ' + part : ''
                return this.span(text);
            } else {
                return (data != '') ? <span>{data}</span> : '';
            }
        } else {
            return '';
        }
    },
    
    line : function(data, label) {
        var text = this.span(data);
        return (data != '') ? <div>{label ? <strong>{label}{' : '}</strong> : ''}{text}</div> : '';
    },
    
    link : function(label, url) {
        return (label && label != '') ? <a href={url ? url : label}>{label}</a> : '';
    }
};

/**
 * Static Object containig metadata of the creator and of the command
 */
var MetaData = {
    icon : 'http://www.bugzilla.org/img/bugzilla_icon.png',
    homepage : 'http://rfobic.wordpress.com/',
    author : { name: "Irakli Gozalishvili", email: "rfobic@gmail.com"}
};

var Bugzilla = {
    getInfo : function() {
        try {
            return rpc(Bugzilla.utils.getXMLRPCLink(Connection.url), 'Bugzilla.version').params.param.version;
        } catch (e if e instanceof IgnorableError) {
            // ignoring as exception was already analized and shown in ui
        } catch (e if e instanceof RpcFault) {
                if (e.causedBy.fault && e.causedBy.fault.faultString)
                    notify({
                        title : Locale.errors.rpcFault,
                        text : e.causedBy.fault.faultString.toString()
                    });
        } catch (e) {
            notify({
                title : Locale.errors.unknown,
                text : e.message
            });
            Logger.log(e);
        }
        return null;
    },
    
    getUsers : function(params) {
        try {
            var users = rpc(Connection.url, 'User.get', params);
        } catch (e if e instanceof IgnorableError) {
            // ignoring as exception was already analized and shown in ui
        } catch (e if e instanceof RpcFault) {
            notify({
                title : Locale.errors.rpcFault,
                text : e.causedBy.fault.faultString.toString()
            });
        } catch (e) {
            notify({
                title : Locale.errors.unknown,
                text : e.message
            });
            Logger.log(e);
        }
    },
    
    getBugs : function(params, callback) {
        try {
            if (callback)
                rpc(Bugzilla.utils.getXMLRPCLink(Connection.url), 'Bug.get_bugs', params, function(data) {
                    callback(data.params.param.bugs);
                });
            else 
                return rpc(Bugzilla.utils.getXMLRPCLink(Connection.url), 'Bug.get_bugs', params).params.param.bugs;
        } catch (e if e instanceof IgnorableError) {
            // ignoring as exception was already analized and shown in ui
        } catch (e) {
            notify({
                title : Locale.errors.unknown,
                text : e.message
            });
            Logger.log(e);
        }
        return null;
    }
};

Bugzilla.utils = {
    getBugLink : function(bugId, url) {
        return url + 'show_bug.cgi?id=' + bugId;
    },
    
    getXMLRPCLink : function(url) {
        return url + 'xmlrpc.cgi';
    },
    
    getLogin : function(id) {
        return CmdUtils.retrieveLogins(id)[0];
    }
};

var Connection = CmdUtils.CreateAdjective({
    _name : 'Connection',
    cache : true,
    dependencies : [
        {
            get reliable() {
                return (Connection.history(1)[0].data);
            }
        }
    ],
    suggest : function(text, html) {
        var connections = this.history();
        var filter = new RegExp('[\s\S]*' + text + '[\s\S]*','i');
        var matchedsuggestions = [];
        var unmatchedSuggestions = [];
        connections.forEach(function(connection){
            var suggestions = filter.test(connection.text) ? matchedsuggestions : unmatchedSuggestions;
            suggestions.push(connection);
        });
        return matchedsuggestions.length ? matchedsuggestions : unmatchedSuggestions;
    },
    default : function() {
        if (this.reliable) {
            Logger.log(this.history(1).toSource())
            return this.history(1);
        }
        return [];
    },
    get url() {
        if (this.reliable)
            return this.history(1)[0].data.url;
        return null;
    }
});

var BugById = CmdUtils.CreateAdjective({
    _name : 'Bug',
    dependencies : [Connection],
    delay : 200,
    suggest : function(text, html, makeSuggestion) {
        var suggestions = [];
        text = text.replace('bugzilla-get ','');
        var params = [{ids : text.split(/\s+/), permissive : true}];
        try {
            if (makeSuggestion) {
                Bugzilla.getBugs(params, function asyncSuggest(bugs) {
                    for each (var bug in bugs) {
                        var bugId = bug.id.toString();
                        makeSuggestion({
                            text : bugId,
                            summary : bugId,
                            html : bugId,
                            data : bug
                        });
                    }
                });
            } else {
                Bugzilla.getBugs(params).forEach(function(){
                    suggestions.push({
                        text : bugId,
                        summary : bugId,
                        html : bugId,
                        data : bug
                    })
                })
            }
        } catch (e) {
            notify({
                title : Locale.errors.unknown,
                text : e.message
            });
        }
        return suggestions;
    },
    default : function(text, html) {
        return this.history(1);
    }
});

CmdUtils.CreateCommand({
    name : 'bugzilla-connection-add',
    icon : MetaData.icon,
    description : 'Creates and stores new connection',
    author : MetaData.author,
    homepage : MetaData.homepage,
    help : 'type bugzilla-add-connection name url user password',
    takes : {
        'url' : noun_arb_text
    },
    modifiers : {
        'name' : noun_arb_text,
        'url' : noun_arb_text,
        'user' : noun_arb_text,
        'password' : noun_arb_text
    },
    
    preview : function(pblock, takes, modifiers) {
        [name, url, username, password] = [modifiers.name.text, modifiers.url.text || takes.text, modifiers.user.text, modifiers.password.text];
        var error = 'color: red';
        var input = 'background: none; border: none; color: white; font-size: 12px;';
        var link = 'text-decoration: underline;'
        pblock.innerHTML =
            <div>
                <b>{'Creates and saves new connection Bugzilla:'}</b>
                <br/>
                <br/>
                <div>
                    <b>{ 'Connection name : '}</b>
                    { name ? <b>{name}</b> : <b style={error}>{'Needs a name'}</b> }
                </div>
                <div>
                    <b>{ 'Bugzilla URL : '}</b>
                    { url ? <code style={link}><a href={url}>{url}</a></code> : <b style={error}>{'Needs url'}</b>}
                </div>
                <div>
                    <b>{ 'User : '}</b>
                    { username ? <input type={'text'} value={username} style={input}/> : <b style={error}>{'Needs user name'}</b>}
                </div>
                <div>
                    <b>{ 'password : '}</b>
                    { password ? <input type={'password'} value={password} style={input}/> : <b style={error}>{'Needs password'}</b>}
                </div>
            </div>.toXMLString();
    },
    
    execute : function(takes, modifiers) {
        try {
            var [name, url, username, password] = [modifiers.name.text, modifiers.url.text || takes.text, modifiers.user.text, modifiers.password.text];
            url = (url.substr(-1) == '/') ? url : url + '/';
            /*
            var logins = LoginManager.findLogins({}, url, null, name);
            for (var i = 0; i < logins.length; i++) {
                LoginManager.removeLogin(logins[i]);
            }
            LoginManager.addLogin(new LoginInfo(url, null, name, username, password, '', ''));
            */
            CmdUtils.savePassword({
                name : url + '#' + name,
                username : username,
                password : password
            }); 
            Connection.addHistory({
                text : name,
                summary : name,
                html : name,
                data : {
                    name : name,
                    url : url,
                    id : url + '#' + name
                }
            });
            notify({
                title : Locale.connection.add,
                text : name + '\n' + url
            });
        } catch(e) {
            notify({
                title : Locale.errors.unknown,
                text : e.message
            });
            Logger.log(e.toSource);
        }
    }
});

CmdUtils.CreateCommand({
    name : 'bugzilla-connection-remove',
    icon : MetaData.icon,
    description : 'Removes selected connection from memory',
    author : MetaData.author,
    homepage : MetaData.homepage,
    help : 'type bugzilla-connection-remove name',
    takes : {
        'connection' : Connection
    },
    preview : function(pblock, takes) {
        if (!takes.data) {
            pblock.innerHTML = Template.needConnection;
            return null;
        }
        var error = 'color: red';
        var input = 'background: none; border: none; color: white; font-size: 12px;';
        var link = 'text-decoration: underline;'
        pblock.innerHTML =
            <div>
                <b>{'Removes Bugzilla connection :'}</b>
                <br/>
                <br/>
                <div>
                    <b>{ takes.text }</b>
                </div>
            </div>.toXMLString();
    },
    execute : function(takes) {
        try {
            Connection.removeHistory(takes);
        } catch(e) {
            notify({
                title : Locale.errors.unknown,
                text : e.message
            });
            Logger.log(e.toSource());
        }
    }
});

CmdUtils.CreateCommand({
    name : 'bugzilla-info-version',
    icon : MetaData.icon,
    description : 'Gets bugzilla version',
    author : MetaData.author,
    homepage : MetaData.homepage,
    help : 'type bugzilla-info-version',
    modifiers : {
        'connection' : Connection
    },
    previewDelay : 200,
    preview : function(pblock, takes, modifiers) {
        if (!modifiers.connection.data) {
            pblock.innerHTML = Template.needConnection;
            return null;
        }
        Connection.addHistory(modifiers.connection);
        pblock.innerHTML =
            <div>
                <b>{Locale.info_version.title + modifiers.connection.text}</b>
                <br/>
                <br/>
                <div id="result">
                    {Template.loader}
                </div>
            </div>.toXMLString();
        
        $('#result', pblock).html(
                <div>
                    <b>{Locale.info_version.version}</b>
                    {Bugzilla.getInfo()}
                </div>.toXMLString());
    },
    execute : function(takes, modifiers) {
        Utils.openUrlInBrowser(modifiers.connection.data.url);
    }
});

CmdUtils.CreateCommand({
    name : 'bugzilla-get',
    icon : MetaData.icon,
    description : Locale.bug.get.description,
    author : MetaData.author,
    homepage : MetaData.homepage,
    help : 'type / select bugzilla id\'s seperated by whitespaces',
    takes : {
        'id' : BugById
    },
    modifiers : {
        'connection' : Connection
    },
    previewDelay : 300,
    preview : function(pblock, takes, modifiers) {
        if (!modifiers.connection.data) {
            pblock.innerHTML = Template.needConnection;
            return null;
        }
        Connection.addHistory(modifiers.connection);
        var bug = takes.data;
        if (bug)
            BugById.addHistory(bug);
        pblock.innerHTML =
            <div>
                <h2 id="title">
                    {Locale.bug.get.title}
                    <span class={bug.internals.resolution.toString().toLowerCase()}>
                        {Template.link(bug.id, Bugzilla.utils.getBugLink(bug.id, modifiers.connection.data.url))}
                    </span>
                </h2>
                <div id="result">
                    {Template.style}
                    {Template.line(bug.alias, Locale.bug.get.alias)}
                    {Template.line(bug.summary)}
                    <br/>
                    {Template.line([bug.internals.bug_status, bug.internals.resolution], Locale.bug.get.bug_status)}
                    {Template.line(bug.internals.status_whiteboard, Locale.bug.get.status_whiteboard)}
                    <br/>
                    {Template.line(bug.internals.product_id, Locale.bug.get.product_id)}
                    {Template.line(bug.internals.component_id, Locale.bug.get.component_id)}
                    {Template.line(bug.internals.version, Locale.bug.get.version)}
                    {Template.line([bug.internals.rep_platform, bug.internals.op_sys], Locale.bug.get.rep_platform)}
                    <br/>
                    {Template.line([bug.internals.priority, bug.internals.bug_severity], Locale.bug.get.bug_severity)}
                    {Template.line(bug.internals.target_milestone, Locale.bug.get.target_milestone)}
                    {Template.line(bug.internals.assigned_to, Locale.bug.get.assigned_to)}
                    {Template.line(bug.internals.qa_contact, Locale.bug.get.qa_contact)}
                    <br/>
                    {Template.line([bug.creation_time.toLocaleString()], Locale.bug.get.creation_time)}
                    {Template.line(bug.last_change_time.toLocaleString(), Locale.bug.get.last_change_time)}
                    
                    {Template.line(Template.link(bug.internals.bug_file_loc), Locale.bug.get.bug_file_loc)}
                </div>
            </div>.toXMLString();
    },
    execute : function(takes, modifiers) {
        Utils.openUrlInBrowser(Bugzilla.utils.getBugLink(takes.text, modifiers.connection.data.url));
    }
});