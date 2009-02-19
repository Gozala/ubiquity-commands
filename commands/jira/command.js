var CC = Components.Constructor;
var LoginManager = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);
var LoginInfo = new CC("@mozilla.org/login-manager/loginInfo;1",Ci.nsILoginInfo,"init");

/**
 * Static Object containig metadata of the creator and of the command
 */
var MetaData = {
    icon : "http://www.atlassian.com/favicon.ico",
    homepage : 'http://rfobic.blogspot.com/2008/10/ubiquity-command-for-jira.html',
    author : { name: "Irakli Gozalishvili", email: "Irakli.Gozalishvili@tomtom.com"}
};

/**
 * Static Object containig subcommands for Ubiquity JIRA Command
 * object is the map of the subcommands and it's descriptions
 */
var Commands = {
    'help' : {
        help : 'Show quick guides for the jira commands.'
    },
    
    'configure' : {
        help : 'Configure settings for JIRA ubiquity command.'
    },
    
    'login' : {
        help : 'Login to JIRA with the specified user / password.'
    },
    
    'logout' : {
        help : 'Logout from JIRA.'
    },
    
    'find' : {
        help : 'Find issues using a free text search, can also limite results to certain projects.'
    },
    
    'get' : {
        help : 'Gets an issue from a given issue key.'
    },
    
    'comment' : {
        help : 'Adds a comment to an issue with specified key.'
    },
    
    'create' : {
        help : 'Creates an issue in JIRA.'
    }
};

var JIRA = {
    
    /**
     * Map of preference names
     */
    prefNames : {
        jiraUrl : 'ubiquity.commands.jira.rpc.url',
        httprealm : 'Ubiquity JIRA Command'
    },
    
    /**
     * Getter for Firefox pereference refering to the JIRA XML-RPC service.
     * @type {String}
     */
    get url() {
        // http://vlieg.intra.local/rpc/xmlrpc
        return Application.prefs.getValue(this.prefNames.jiraUrl, '');
    },
    
    /**
     * Setter for Firefox pereference refering to the JIRA XML-RPC service.
     * @param url {String}
     */
    set url(value) {
        return Application.prefs.setValue(this.prefNames.jiraUrl, value);
    },
    
    /**
     * Getter interacts with nsILoginManager to retrive user / password for JIRA XML-RPC Service
     * @return data {Object} Object conatinig memebrs user, password {user : .., password : ..}
     */
    get loginData() {
        var logins = LoginManager.findLogins({}, this.url, null, this.prefNames.httprealm);
        for (var i = 1; i < logins.length; i++) {
            LoginManager.removeLogin(logins[i]);
        }
        return logins.length > 0 ? logins[0] : null;
    },
    
    /**
     * Setter interacts with nsILoginManager to save user / password for JIRA XML-RPC Service
     * @param username, password {Object} Object conatinig memebrs username, password
     */
    set loginData(data) {
        var oldLoginData = this.loginData;
        var newloginData = new LoginInfo(this.url, null, this.prefNames.httprealm, data.username, data.password, '', '');
        
        if (oldLoginData) {
            LoginManager.modifyLogin(oldLoginData, newloginData);
        } else {
            LoginManager.addLogin(newloginData);
        }
    },
    
    /**
     * Getter for Session id for the current log in
     * @type {String}
     */
    get session() {
        if (!this._session)
            this._login(this.loginData.username, this.loginData.password);
        return this._session;
    },
    /**
     * @private
     * Session id for the current log in
     * @type {String}
     */
    _session : null,
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
        var methodResponce = new XML(jQuery.ajax({
                    url : url,
                    type : 'POST',
                    data :  <methodCall>
                                <methodName>{method}</methodName>
                                {data}
                            </methodCall>.toXMLString(),
                    async : false,
                    contentType : 'text/xml',
                    dataType : 'xml'
                }).responseText.replace(/^<\?xml\s+version\s*=\s*(["'])[^\1]+\1[^?]*\?>/,""));
        
        if (methodResponce.fault.length()) {
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
                    return new Number(member.text());
                    break;
                case 'int' :
                    return new Number(member.text());
                    break;
                case 'string' :
                    return new String(member.text());
                    break;
                case 'double' :
                    return new Number(member.text());
                    break;
                case 'dateTime.iso8601' :
                    return new Date(member.text());
                    break;
                case 'base64' :
                    return member.text();
                    break;
                
                case 'value' :
                    return self(member);
                    break;
                case 'struct' :
                    return self(member);
                    break;
                case 'member' :
                    data[member.name.text()] = self(member.value);
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
    getFavouriteFilters : function() {
        try {
            return this.rpc2json(this.rpc(this.url, 'jira1.getSavedFilters',
                <params>
                    <param>
                        <value>{this.session}</value>
                    </param>
                </params>
                ).params.param);
        } catch (e) {
            if (e instanceof XML)
                displayMessage(e.fault.value.struct.member.value[0]);
            else
                displayMessage(e.toString());
        }
    }
};

var noun_type_command = {
    _name : 'command',
    
    suggest : function(text, html) {
        var filter = new RegExp('[\s\S]*' + text + '[\s\S]*');
        var suggestions = [];
        var allCommands = [];
        
        for (var key in Commands) {
            allCommands.push({
                text : key,
                summary : key,
                html : key
            });
            
            
            if(filter.test(key)) {
                suggestions.push({
                    text : key,
                    summary : key,
                    html : key
                });
            }
        }
        
        return suggestions.length > 0 ? suggestions : allCommands;
    }
};

var noun_type_jira_setting = new CmdUtils.NounType( "value", ['login', 'url']);
var noun_type_jira_issue = {
    _name : 'Issue',
    
    suggest : function(key, html) {
        var suggestions = [];
        if (/[\w\W]+\-\d+/.test(key)) {
            var issue = JIRA.getIssue(key);
            dump('\n\n'+issue.toSource()+'\n\n');
            
            suggestions.push({
                        text : key,
                        summary : key,
                        html : key,
                        data : issue
            });
        }
        return suggestions;
    }
};
var nonun_type_jira_filter = {
    _name : 'Filter',
    
    suggest : function(text, html) {
        var suggestions = [];
        var filters = JIRA.getFavouriteFilters();
        dump('\n\n\n---------------\n'+filters.toSource())
    }
};

CmdUtils.CreateCommand({
    name : 'jira-help',
    
    icon : MetaData.icon,
    
    description : Commands['help'].help,
    
    author : MetaData.author,
    
    homepage : MetaData.homepage,
    
    help : Commands['help'].help,
    
    takes : {
        'command': noun_type_command
    },
    
    preview : function(pblock, takes) {
        if (takes.text == '') {
            var html = '';
            for (var key in Commands) {
                html += '<b> jira-' + key + '<b><br/>'+ Commands[key].help + '<br/>';
            }
            pblock.innerHTML = html;
        } else {
            var key = takes.text;
            pblock.innerHTML = '<b> jira-' + key + '<b><br/>'+ Commands[key].help + '<br/>';
        }
    },
    
    execute : function(noun) {
        noun.data.action();
    }
});

CmdUtils.CreateCommand({
    name : 'jira-configure',
    
    icon : MetaData.icon,
    
    description : Commands['configure'].help,
    
    author : MetaData.author,
    
    homepage : MetaData.homepage,
    
    help : Commands['configure'].help,
    
    takes : {
        'setting': noun_arb_text
    },
    
    modifiers : {
        'set' : noun_type_jira_setting
    },
    
    preview : function(pblock, takes, modifiers) {
        if (modifiers.set.text == 'url') {
             var info = 'Sets preference for JIRA XMLRPC URL to the: <br/><br/>' +
                '<b><u><a href="' + takes.text + '">' + takes.text + '</a></u></b>' +
                '<br/><br/><i>This url is used by Ubiquity JIRA command to work with JIRA XMLRPC service</i>'
                var currentURL = JIRA.url;
                if (currentURL != '') {
                    info += '<br/><br/>Currently used URL is: <br/><br/><u><a href="' + currentURL + '">' + currentURL + '</a></u>';
                }
            pblock.innerHTML = info;
        } else if (modifiers.set.text == 'login') {
            if (JIRA.url == '') {
                pblock.innerHTML = '<b style="color: red;"> To configure login you need to configure JIRA XMLRPC URL first</b>' +
                    '<br/><br/>To do that please use:<br/><br/>jira-configure set url &lt;url&gt;';
            } else {
                var [username, password] = takes.text.split('/');
                if (username && password)
                    pblock.innerHTML = 'Sets JIRA XMLRPC login settings to:<br/><br/>' +
                        'Username: <input style="border: none; color: white; background: transparent;" type="text" id="jira-user" name="jira-user" value="' + username + '"/><br/>' +
                        'Password: <input style="border: none; color: white; background: transparent;" type="password" name="jira-pass" name="jira-pass" value="' + password + '"/><br/>' +
                        '<br/><br/><i>This user / password will be used by Ubiquity JIRA command to work with JIRA XMLRPC service</i>'
                else
                    pblock.innerHTML = '<b style="color: red;"> To configure login you need to type / select string which matches the pattern:</b>' +
                    '<br/><br/>&lt;user&gt;/&lt;password&gt;';
            }
        } else {
            noun_type_command.suggest('','');
            pblock.innerHTML = '<b> Use modifires to configure JIRA Ubiquity command</b><br/>if you want to set login settings type <br/><b>jira-configure set login &lt;user&gt;/&lt;password&gt;</b><br/><br/>if you want to set url settings type <br/><b>jira-configure set url &lt;url&gt;</b>';
        }
    },
    
    execute : function(takes, modifiers) {
        if (modifiers.set.text == 'url') {
            JIRA.url = takes.text;
        } else if (modifiers.set.text == 'login' && JIRA.url != '') {
            var [username, password] = takes.text.split('/');
            try {
                if (username && password)
                    JIRA.loginData = {username : username, password : password};
            } catch(e) {
                displayMessage(e);
            }
        }
    }
});
CmdUtils.CreateCommand({
    name : 'jira-login',
    
    icon : MetaData.icon,
    
    description : Commands['login'].help,
    
    author : MetaData.author,
    
    homepage : MetaData.homepage,
    
    help : Commands['login'].help,
    
    takes : {
        'command': noun_arb_text
    },
    
    preview : function(pblock, takes) {
        if (takes.text == 'force')
            JIRA._session = null;
        pblock.innerHTML = JIRA.session;
    },
    
    execute : function(noun) {
        
    }
});

CmdUtils.CreateCommand({
    name : 'jira-get',
    
    icon : MetaData.icon,
    
    description : Commands['get'].help,
    
    author : MetaData.author,
    
    homepage : MetaData.homepage,
    
    help : Commands['get'].help,
    
    takes : {
        'issue key': noun_type_jira_issue
    },
    
    preview : function(pblock, takes) {
        var issue = takes.data;
        pblock.innerHTML = <div id="issue">
            <div>Key : <b>{issue.key}</b></div>
            <div>Type : <b>{issue.type}</b></div>
            <div>Status : <b>{issue.status}</b></div>
            <div>Priority : <b>{issue.priority}</b></div>
            <div>Assignee : <b>{issue.assignee}</b></div>
            <div>Reporter : <b>{issue.reporter}</b></div>
            <div>Project : <b>{issue.project}</b></div>
            <div>Created : <b>{issue.created}</b></div>
            <div>Updated : <b>{issue.updated}</b></div>
            <br/>
            <div>{issue.summary}</div>
            <br/>
            <div><i>{issue.description}</i></div>
        </div>.toXMLString();
    },
    
    execute : function(noun) {
        
    }
});
CmdUtils.CreateCommand({
    name : 'jira-filters',
    
    icon : MetaData.icon,
    
    description : Commands['get'].help,
    
    author : MetaData.author,
    
    homepage : MetaData.homepage,
    
    help : Commands['get'].help,
    
    takes : {
        'filter': nonun_type_jira_filter
    },
    
    preview : function(pblock, takes) {
        /* var issue = takes.data;
        pblock.innerHTML = <div id="issue">
            <div>Key : <b>{issue.key}</b></div>
            <div>Type : <b>{issue.type}</b></div>
            <div>Status : <b>{issue.status}</b></div>
            <div>Priority : <b>{issue.priority}</b></div>
            <div>Assignee : <b>{issue.assignee}</b></div>
            <div>Reporter : <b>{issue.reporter}</b></div>
            <div>Project : <b>{issue.project}</b></div>
            <div>Created : <b>{issue.created}</b></div>
            <div>Updated : <b>{issue.updated}</b></div>
            <br/>
            <div>{issue.summary}</div>
            <br/>
            <div><i>{issue.description}</i></div>
        </div>.toXMLString();*/
    },
    
    execute : function(noun) {
        
    }
});