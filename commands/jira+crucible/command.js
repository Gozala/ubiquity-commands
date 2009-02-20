var noun_type_jira = {
    
    _name: "jira noun",
    
    get baseJiraURL() {
        return Application.prefs.getValue('ubiquity.commands.jira.jiraUrl',null);
    },
    
    set baseJiraURL(value) {
        return Application.prefs.setValue('ubiquity.commands.jira.jiraUrl',value);
    },
    
    get baseCrucibleURL() {
        return Application.prefs.getValue('ubiquity.commands.jira.crucibleUrl',null);
    },
    
    set baseCrucibleURL(value) {
        return Application.prefs.setValue('ubiquity.commands.jira.crucibleUrl',value);
    },
    
    get searchJiraURL() {
        return noun_type_jira.baseJiraURL+'secure/QuickSearch.jspa?searchString=';
    },
    
    get searchCrucibleURL() {
        return noun_type_jira.baseCrucibleURL + 'cru/search?query=';
    },
    
    get createJiraURL() {
        return noun_type_jira.baseJiraURL+'secure/CreateIssue!default.jspa';
    },
    
    get createCrucibleURL() {
        return noun_type_jira.baseCrucibleURL+'cru/createReview';
    },
    
    get iconJiraURL() {
        return 'https://jira.atlassian.com/favicon.ico';
    },
    
    get iconCrucibleURL() {
        return 'http://fisheye.atlassian.com/favicon.ico';
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


CmdUtils.CreateCommand({
    name: "jira",
    icon: "http://www.atlassian.com/favicon.ico",
    description: "Searches for JIRA issues / Crucible reviews. You need to specify the site URL of JIRA and Crucible before you'll start useing it",
    author: { name: "Irakli Gozalishvili", email: "Irakli.Gozalishvili@tomtom.com"},
    homepage: 'http://rfobic.blogspot.com/2008/10/ubiquity-command-for-jira-crucible.html',
    help: 'You just need to enter or select some key word and command wil ldo the rest',
    takes: {"jira": noun_type_jira},
    
    preview: function(pblock, noun) {
       // let template = "<div style='font-family:Sans;font-size:9px'><img src='https://jira.atlassian.com/favicon.ico' alt=''/>${action}<br/>${url}</div>";
        //var suggestions = noun.text;
        //var msg = "Action : <b style=\"color:yellow\">%s</b>";
        pblock.innerHTML = noun.html; //msg.replace(/%s/, suggestions);
    },

    execute: function(noun) {
        noun.data.action();
    }
});