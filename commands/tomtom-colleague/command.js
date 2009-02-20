var TomTom = {
    Nouns : {
        Colleague : {
            _name : 'Colleague Name',
            
            suggest : function(text, html, makeSuggestion) {
                var suggestions = [];
                
                jQuery.ajax({
                    url : 'http://tomtomintranet.intra.local/addressbook.jsp',
                    data : {
                        action : 'search',
                        search : text,
                    },
                    success: function suggestAsync(responce) {
                            jQuery('table:has(#employee)', responce).each(function() {
                                var employee = {
                                    img : jQuery('img', this).attr('src')
                                };
                                employee.img = employee.img ? 'http://tomtomintranet.intra.local' + employee.img : null;
                                
                                jQuery('#employee tr', this).each(function() {
                                    employee[jQuery('td:eq(0)', this).text().replace(/[\:\#\s+$]/ig, '')] = jQuery('td:eq(1)', this).text();
                                });
                                
                                makeSuggestion({
                                    text : employee.Name,
                                    summary : employee.Name,
                                    html : employee.Name,
                                    data : employee
                                });
                            });
                    }
                });
                return [];
            },
            
            default : function() {
                return this._lastResult.toSource() == '{}' ? this._lastResult : {
                    text : 'no results',
                    summary : 'no results',
                    html : 'no results',
                    data : {
                        img : 'http://a.wordpress.com/avatar/unknown-48.jpg'
                    }
                };
            },
            
            _prefName : 'ubiquity.commands.tomtom.colleague.last',
            
            set _lastResult(employee) {
                Application.prefs.setValue(this._prefName, Utils.encodeJson(employee));
            },
            
            get _lastResult() {
                return Utils.decodeJson(Application.prefs.getValue(this._prefName, '{}'));
            }
        }
    }
};

CmdUtils.CreateCommand({
    name : 'tomtom-colleague',
    
    icon : 'http://tomtomintranet.intra.local//favicon.ico',
    
    description : 'Creates and stores new session',
    
    author : {
        name: "Irakli Gozalishvili",
        email: "Irakli.Gozalishvili@tomtom.com"
    },
    
    homepage : 'http://rfobic.wordpress.com/',
    
    help : 'type bugzilla-add-session name url user password',
    
    takes : {
        'name' : TomTom.Nouns.Colleague,
    },
    
    previewDelay : 200,
    
    preview : function(pblock, takes) {
        var colleague = takes.data;
        var tdCSS = 'vertical-align: top; text-align: left; width: 300px;';
        imgtdCSS = 'vertical-align: top; text-align: right; padding-left: 8px;';
        var imageCSS = 'width: 100px;'
        pblock.innerHTML = 
            <table>
                <tr>
                    <td style={tdCSS}>
                        <div><b>{colleague.Name}</b></div>
                        <br/>
                        { colleague.Employee ? <div><span>Employee #</span> <span>{colleague.Employee}</span></div> : ''}
                        { colleague.Department ? <div><span>Department:</span> <span>{colleague.Employee}</span></div>  : ''}
                        { colleague.Office ? <div><span>Office:</span> <span>{colleague.Office}</span></div>  : ''}
                        { colleague['Job Title'] ? <div><span>Position:</span> <span>{colleague['Job Title']}</span></div>  : ''}
                        { colleague.Telephone ? <div><span>Phone:</span> <span>{colleague.Telephone}</span></div>  : ''}
                        { colleague.Mobile ? <div><span>Mobile:</span> <span>{colleague.Mobile}</span></div>  : ''}
                        { colleague.Email ? <div><span>Email:</span> <u><a href={'mailto:' + colleague.Email}>{colleague.Email}</a></u></div>  : ''}
                    </td>
                    { colleague.img ? <td style={imgtdCSS}><img style={imageCSS} src={colleague.img} alt=''/></td> : '' }
                </tr>
            </table>.toXMLString();
    },
    
    execute : function(takes, modifiers) {
    }
});