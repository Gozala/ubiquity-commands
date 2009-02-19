var CC = Components.Constructor;
var LoginManager = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);
var LoginInfo = new CC("@mozilla.org/login-manager/loginInfo;1",Ci.nsILoginInfo,"init");

/**
 * Static Object containig metadata of the creator and of the command
 */
var MetaData = {
    icon : 'http://www.bugzilla.org/img/bugzilla_icon.png',
    homepage : 'http://rfobic.blogspot.com/2008/10/ubiquity-command-for-bugzilla.html',
    author : { name: "Irakli Gozalishvili", email: "Irakli.Gozalishvili@tomtom.com"}
};

var Session = function(nick, url, username, password) {
    this.nick = nick;
    
    // creating new session
    if (url && username && password) {
        // remove login if exists
        this.remove();
        // creating instance of nsILoginInfo
        var login = new LoginInfo(url, null, nick, username, password, '', '');
        // adding / changeing Bugzilla xml-rpc url for session
        Bugzilla._prefs.setValue(Bugzilla._prefNames.url + nick, url);
        // adding session to bookmarks
        Bugzilla._prefs.setValue(Bugzilla._prefNames.sessions, Bugzilla._prefs.getValue(Bugzilla._prefNames.sessions,'') + Bugzilla._prefNames.splitter + nick);
        // storing user and password
        LoginManager.addLogin(login);
    }
};

Session.prototype = {
    /**
     * Session name
     * @type {string}
     */
    nick : null,
    
    /**
     * Url of the Bugzilla XML-RPC service for this session
     * @type {String}
     */
    get url() {
        return Bugzilla._prefs.getValue(Bugzilla._prefNames.url + this.nick, '');
    },
    
    /**
     * getter for a user and password
     * @type {Object}
     * { username : 'MyUeser', password : 'myPassword'}
     */
    get login() {
        var logins = LoginManager.findLogins({}, this.url, null, this.nick);
        return logins.length > 0 ? {username : logins[0].username, password : logins[0].password} : null;
    },
    
    /**
     * Removes current login from memory
     */
    remove : function() {
        // removeing from stored sessions
        Bugzilla._prefs.setValue(Bugzilla._prefNames.sessions, Bugzilla._prefs.getValue(Bugzilla._prefNames.sessions,'').replace(Bugzilla._prefNames.splitter + this.nick, ''));
        // removeing login info from LoginManager
        var logins = LoginManager.findLogins({}, this.url, null, this.nick);
        for (var i = 0; i < logins.length; i++) {
            LoginManager.removeLogin(logins[i]);
        }
    }
};



var Bugzilla = {
    /**
     * Last accessed session
     * @type {Object}
     * {
     *      url : 'https://bugzilla.mozilla.org/xmlrpc.cgi',
     *      user : 'myUser',
     *      password : 'myPassword'
     * }
     */
    _lastSession : null,
    
    get lastSession() {
        if (!this._lastSession) {
            var lastSessionName = this._prefs.getValue(this._prefNames.lastSession, null);
            this._lastSession = lastSessionName ? new Session(lastSessionName) : null;
        }
        return  this._lastSession;
    },
    
    set lastSession(session) {
        this._prefs.setValue(this._prefNames.lastSession, session.nick);
        this._lastSession = session;
    },
    
    _prefs : Application.prefs,
    
    /**
     * Map of preference names
     */
    _prefNames : {
        splitter : '|',
        sessions : 'ubiquity.commands.bugzilla.sessions',
        url : 'ubiquity.commands.bugzilla.url.',
        lastSession : 'ubiquity.commands.bugzilla.lastSession'
    },
    
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
    rpc : function(url, method, data) {
        var methodResponce = this.rpc2json(new XML(jQuery.ajax({
                    url : url,
                    type : 'POST',
                    data :  <methodCall>
                                <methodName>{method}</methodName>
                                {this.json2rpc(data)}
                            </methodCall>.toXMLString(),
                    async : false,
                    contentType : 'text/xml',
                    dataType : 'xml'
                }).responseText.replace(/^<\?xml\s+version\s*=\s*(["'])[^\1]+\1[^?]*\?>/,"")));
        
        if (methodResponce.fault) {
            throw methodResponce;
        } else {
            return methodResponce;
        }
    },
    
    /**
     * Recursive function converts responce of the RPC
     * call to the JSON Object
     * @returns {Object} JSON type object
     */
    rpc2json : function(xml) {
        var self = arguments.callee;
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
                    return new Date(member.text());
                    break;
                case 'base64' :
                    return member.text();
                    break;
                case 'value' :
                case 'struct' :
                case 'methodResponse' :
                    return self(member);
                    break;
                case 'member' :
                    data[member.name.text()] = self(member.value);
                    break;
                case 'fault' :
                case 'params' :
                case 'param' :
                    data[member.name().toString()] = self(member);
                    break;
                case 'array' :
                    var tempArray = [];
                    for each (value in member.data.value) {
                        tempArray.push(self(value));
                    }
                    return tempArray;
                    break;
                default :
                    return null;
            }
        }
        return data;
    },
    
    /**
     * Recursive function converts JSON type object to RPC method call like xml
     * @returns {XML} E4X object
     */
    json2rpc : function(json) {
        var self = arguments.callee;
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
                    if (self == self.caller) {
                        var tempArray = <array><data/></array>;
                        for each(member in json)
                            tempArray.data.appendChild(<value>{self(member)}</value>);
                        return tempArray;
                    } else {
                        result = <params/>
                        for each(member in json)
                            result.appendChild(<param><value>{self(member)}</value></param>);
                        return result;
                    }
                } else {
                    var struct = <struct/>;
                    for (key in json)
                        struct.appendChild(
                            <member>
                                <name>{key}</name>
                                <value>{self(json[key])}</value>
                            </member>
                        );
                    return struct;
                }
            break;
        }
    },
    
    /**
     * Makes login to the JIRA XML-RPC Service and stores session id in the session memebr.
     * @private
     * @param user {String} Username
     * @param password {String}
     * @returns {void}
     */
    _login : function(user, password) {
        try {
            this._session = this.rpc2json(this.rpc(this.url, 'jira1.login',
                <params>
                    <param>
                        <value>{user}</value>
                    </param>
                    <param>
                        <value>{password}</value>
                    </param>
                </params>).params.param);
        } catch (e) {
            if (e instanceof XML)
                displayMessage(e.fault.value.struct.member.value[0]);
            else
                displayMessage(e.toString());
        }
    },
    
    getIssue : function(key) {
        try {
            return this.rpc2json(this.rpc(this.url, 'jira1.getIssue',
                <params>
                    <param>
                        <value>{this.session}</value>
                    </param>
                    <param>
                        <value>{key}</value>
                    </param>
                </params>
                ).params.param);
        } catch (e) {
            if (e instanceof XML)
                displayMessage(e.fault.value.struct.member.value[0]);
            else
                displayMessage(e.toString());
        }
    },
    
    getInfo : function() {
        try {
            return this.rpc(Bugzilla.lastSession.url, 'Bugzilla.version').params.param.version;
        } catch (e if e.fault && e.fault.faultString) {
            displayMessage(e.fault.faultString);
        } catch (e) {
            displayMessage(e);
        }
    },
    
    getUsers : function(params) {
        try {
            dump('\n\n');
            dump(this.rpc(Bugzilla.lastSession.url, 'User.get', params).toSource());
            dump('\n\n');
        } catch (e if e.fault && e.fault.faultString) {
            displayMessage(e.fault.faultString.toString());
            dump('\nError> ' + e.fault.faultString);
        } catch (e) {
            displayMessage(e);
        }
    },
    
    getBugs : function(params) {
        try {
            return this.rpc(Bugzilla.lastSession.url, 'Bug.get_bugs', params).params.param.bugs;
        } catch (e if e.fault && e.fault.faultString) {
            displayMessage(e.fault.faultString.toString());
            dump('\nError> ' + e.fault.faultString);
            dump('\nError> ' + e.toSource());
        } catch (e) {
            displayMessage(e);
            dump('\nError> ' + e.stack);
        }
    }
};

Bugzilla.nouns = {
    session : {
        _name : 'Session',
        
        suggest : function(text, html) {
            var sessions = Bugzilla._prefs.getValue(Bugzilla._prefNames.sessions, '').split(Bugzilla._prefNames.splitter);
            var filter = new RegExp('[\s\S]*' + text + '[\s\S]*','i');
            var matchedsuggestions = [];
            var unmatchedSuggestions = [];
            
            for each (var session in sessions) {
                var suggestions = filter.test(session) ? matchedsuggestions : unmatchedSuggestions;
                suggestions.push({
                    text : session,
                    summary : session,
                    html : session,
                    data : new Session(session)
                });
                
            }
            
            return matchedsuggestions.length ? matchedsuggestions : unmatchedSuggestions;
        },
        
        default : function() {
            if (Bugzilla.lastSession)
                return {
                    text : Bugzilla.lastSession.nick,
                    summary : Bugzilla.lastSession.nick,
                    html : Bugzilla.lastSession.nick,
                    data : Bugzilla.lastSession
                };
        }
    },
    
    bugByID : {
        _name : 'Bug',
        
        suggest : function(text, html) {
            var suggestions = [];
            var bugs = Bugzilla.getBugs([{ids : text.split(/\s+/), permissive : true}]);
            
            for each (var bug in bugs) {
                suggestions.push({
                    text : bug.internals.bug_id,
                    summary : bug.internals.bug_id,
                    html : bug.internals.bug_id,
                    data : bug
                });
            }
            return suggestions;
        },
        
        default : function() {
            return {
                text : 'No bugs being found',
                summary : 'No bugs being found',
                html : '',
                data : {}
            };
        }
    }
};


CmdUtils.CreateCommand({
    name : 'bugzilla-session-add',
    
    icon : MetaData.icon,
    
    description : 'Creates and stores new session',
    
    author : MetaData.author,
    
    homepage : MetaData.homepage,
    
    help : 'type bugzilla-add-session name url user password',
    
    modifiers : {
        'name' : noun_arb_text,
        'url' : noun_arb_text,
        'user' : noun_arb_text,
        'password' : noun_arb_text
    },
    
    preview : function(pblock, takes, modifiers) {
        [name, url, username, password] = [modifiers.name.text, modifiers.url.text, modifiers.user.text, modifiers.password.text];
        var error = 'color: red';
        var input = 'background: none; border: none; color: white; font-size: 12px;';
        var link = 'text-decoration: underline;'
        pblock.innerHTML =
            <div>
                <b>{'Creates and saves new session Bugzilla:'}</b>
                <br/>
                <br/>
                <div>
                    <b>{ 'Session name : '}</b>
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
        [name, url, username, password] = [modifiers.name.text, modifiers.url.text || takes.text, modifiers.user.text, modifiers.password.text];
        try {
            if (name && url && username && password)
                var session = new Session(name, url, username, password);
                if (!Bugzilla.lastSession) {
                    Bugzilla.lastSession = session;
                }
        } catch(e) {
            displayMessage(e.toSource());
        }
    }
});

CmdUtils.CreateCommand({
    name : 'bugzilla-session-remove',
    
    icon : MetaData.icon,
    
    description : 'Removes selected session from memory',
    
    author : MetaData.author,
    
    homepage : MetaData.homepage,
    
    help : 'type bugzilla-session-remove name',
    
    takes : {
        'session' : Bugzilla.nouns.session,
    },
    
    preview : function(pblock, takes) {
        
        var error = 'color: red';
        var input = 'background: none; border: none; color: white; font-size: 12px;';
        var link = 'text-decoration: underline;'
        pblock.innerHTML =
            <div>
                <b>{'Removes Bugzilla session :'}</b>
                <br/>
                <br/>
                <div>
                    <b>{ takes.text }</b>
                </div>
            </div>.toXMLString();
    },
    
    execute : function(takes) {
        try {
            (new Session(takes.text)).remove();
        } catch(e) {
            displayMessage(e.toSource());
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
        'session' : Bugzilla.nouns.session,
    },
    
    previewDelay : 200,
    
    preview : function(pblock, takes, modifiers) {
        Bugzilla.lastSession = modifiers.session.data;
        pblock.innerHTML =
            <div>
                <b>{'Bugzilla information : '+ modifiers.session.text}</b>
                <br/>
                <br/>
                <div>
                    <b>{ 'Version : '}</b>
                    { Bugzilla.getInfo() }
                </div>
            </div>.toXMLString();
    },
    
    execute : function(takes, modifiers) {}
});

CmdUtils.CreateCommand({
    name : 'bugzilla-user',
    
    icon : MetaData.icon,
    
    description : 'Gets information about user accounts in Bugzilla',
    
    author : MetaData.author,
    
    homepage : MetaData.homepage,
    
    //help : 'type bugzilla-info-version',
    
    modifiers : {
        'id' : noun_arb_text,
        'name' : noun_arb_text,
        'match' : noun_arb_text,
        'session' : Bugzilla.nouns.session,
    },
    
    previewDelay : 200,
    
    preview : function(pblock, takes, modifiers) {
        Bugzilla.lastSession = modifiers.session.data;
        pblock.innerHTML =
            <div>
                <b>{'User information : '+ modifiers.id.text}</b>
                <br/>
                <br/>
                <div>
                    <b>{ 'Version : '}</b>
                    {Bugzilla.getUsers({
                        params : {
                            param : {
                                ids : modifiers.id.text.split('|')
                            }
                        }
                    })}
                </div>
            </div>.toXMLString();
    },
    
    execute : function(takes, modifiers) {}
});

CmdUtils.CreateCommand({
    name : 'bugzilla-get',
    
    icon : MetaData.icon,
    
    description : 'Gets information about particular bugs in the database.',
    
    author : MetaData.author,
    
    homepage : MetaData.homepage,
    
    //help : 'type bugzilla-info-version',
    takes : {
        'id' : Bugzilla.nouns.bugByID
    },
    
    modifiers : {
        'session' : Bugzilla.nouns.session,
    },
    
    previewDelay : 300,
    
    preview : function(pblock, takes, modifiers) {
        Bugzilla.lastSession = modifiers.session.data;
        var bug = takes.data.internals;
        pblock.innerHTML =
            <div>
                <b><u>{'Bug '+ bug.bug_id}</u></b>
                <br/>
                <br/>
                <b>{bug.short_desc}</b>
                <br/><br/>
                <div>
                    {bug.resolution ? <div><span>{'Resolution : '}</span><span>{bug.resolution}</span></div> : ''}
                    {bug.version ? <div><span>{'Version : '}</span><span>{bug.version}</span></div> : ''}
                    {bug.version ? <div><span>{'Target Milestone : '}</span><span>{bug.target_milestone}</span></div> : ''}
                    <br/>
                    {bug.version ? <div><span>{'Status : '}</span><span>{bug.bug_status}</span></div> : ''}
                    {bug.version ? <div><span>{'Priority : '}</span><span>{bug.priority}</span></div> : ''}
                    {bug.version ? <div><span>{'Severity : '}</span><span>{bug.bug_severity}</span></div> : ''}
                    <br/>
                    {bug.version ? <div><span>{'Platform : '}</span><span>{bug.rep_platform}</span></div> : ''}
                    {bug.version ? <div><span>{'OS : '}</span><span>{bug.op_sys}</span></div> : ''}
                    <br/>
                    {bug.bug_file_loc != '' ? <div><span>{'Location : '}</span><u><a href={bug.bug_file_loc}>{bug.bug_file_loc}</a></u></div> : ''}
                </div>
            </div>.toXMLString();
    },
    
    execute : function(takes, modifiers) {}
});
