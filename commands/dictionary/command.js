//Dictionary
var URL = null;
var Languages = ["georgian","english","russian","german","french","italian","spanish"];
noun_type_dyctionaryLanguage = new CmdUtils.NounType( "Language",Languages);

CmdUtils.CreateCommand({
    name: "dictionary",
    icon: "http://www.lingvo.ru/upload/images/Lingvo.ico",
    description: "Translates first word",
    author: { name: "Irakli Gozalishvili", email: "rfobic@gmail.com"},
    homepage: 'http://rfobic.blogspot.com/2008/10/ubiquity-command-dictionary.html',
    help: 'Select or type the word to translate',
    takes: {"word": noun_arb_text},
    modifiers: {from: noun_type_dyctionaryLanguage, to: noun_type_dyctionaryLanguage},
    
    preview: function(pblock, noun, attributes) {
        var loading = function() {
            pblock.innerHTML = CmdUtils.renderTemplate(template, {
                    content: '<img src="chrome://global/skin/icons/loading_16.png" alt=""/> Searching for <strong>'+params.w+'</strong>'
                }
            );
        };
        
        var translate = function(from,to) {
            loading();
            jQuery.get(url, params, function(html) {
                if(html=="") {
                    if(params.w!="") {
                        params.w = params.w.substring(0,params.w.length-1);
                        translate(from,to);
                    } else {
                        pblock.innerHTML = CmdUtils.renderTemplate(template, {
                                content: 'No matching words found'
                            }
                        );
                    }
                } else {
                    if (resource != 'translate.ge') {
                        jQuery(pblock).append('<div id="temp" hidden="true"/>');
                        var temp = jQuery(pblock).find('#temp')
                        temp.html(html);
                        var injection = temp.find('#WordSection').html();
                        temp.remove();
                    } else {
                        var injection = html;
                    }
                    
                    pblock.innerHTML = CmdUtils.renderTemplate(template, {
                            content: '<div><u>Results for <strong>'+params.w+'</strong> are:</u></div>'+injection
                        }
                    );
                }
            });
        };

        var template = "<style>";
            template += "#UbiquityDictionary {overflow: auto;}";
            template += " b { font-style: normal; font-size: 12px; font-weight: normal; }";
            template += " i { color: green; font-variant: normal; font-weight: bold; font-family:Sylfaen; font-size: 12px; }";
            template += ".word {color: blue; font-variant: normal; font-weight: bold; font-size: 13px; }";
            template += ".notFound {color: red; font-variant: normal; font-weight: bold; font-size: 13px; }";
            template += "</style>\n";
            template += "<div id='UbiquityDictionary'>${content}</div>";
        
        var abort = false;
        var word = noun.text.split(' ',1)[0];
        var url = Application.prefs.getValue('ubiquity.commands.Dictionary.lingvo_Url','http://www.abbyyonline.com/translate.aspx');
        var from = attributes.from.text || Application.prefs.getValue('ubiquity.commands.Dictionary.from',Languages[1]);
        var to = attributes.to.text || Application.prefs.getValue('ubiquity.commands.Dictionary.to',Languages[0]);
        var translationHash = 0;
        var resource = 'Lingvo';
        
        if (from == Languages[1] && to == Languages[0]) { // English > Georgian
            url = Application.prefs.getValue('ubiquity.commands.Dictionary.EnGe_Url','http://translate.ge/q.aspx');
            resource = 'translate.ge';
        } else if (from == Languages[0] && to == Languages[1]) { // Georgian > English
            url = Application.prefs.getValue('ubiquity.commands.Dictionary.GeEn_Url','http://translate.ge/g.aspx');
            resource = 'translate.ge';
        } else if ((from == Languages[1] && to == Languages[2]) ||  // English > Russian
                    (from == Languages[2] && to == Languages[1])) { // Russian > English
            translationHash = 1;
        } else if ((from == Languages[3] && to == Languages[2]) ||  // German > Russian
                    (from == Languages[2] && to == Languages[3])) { // Russian > German
            translationHash = 2;
        } else if ((from == Languages[4] && to == Languages[2]) ||  // French > Russian
                    (from == Languages[2] && to == Languages[4])) { // Russian > French
            translationHash = 3;
        } else if ((from == Languages[5] && to == Languages[2]) ||  // Italian > Russian
                    (from == Languages[2] && to == Languages[5])) { // Russian > Italian 
            translationHash = 4;
        } else if ((from == Languages[6] && to == Languages[2]) ||  // Spanish > Russian
                    (from == Languages[2] && to == Languages[6])) { //Russian > Spanish
            translationHash = 5;
        } else {
            pblock.innerHTML = CmdUtils.renderTemplate(template, {content: 'Cant translate <strong>'+word+'</strong> from <strong>'+from+'</strong> to <strong>'+to+'</strong>'});
            abort = true;
        }
        
        if(!abort) {
            var params = {
                words : word,
                w : word,
                LingvoAction : 'translate',
                Ln : translationHash
            };
            translate(from,to);
            URL = url+"?w="+params.w+'&words='+params.words+'&LingvoAction='+params.LingvoAction+"&Ln="+params.Ln+"&from="+from+"&to="+to;
        }
    },

    execute: function(noun) {
        window.getBrowser().selectedTab = window.getBrowser().addTab(URL);
    }
});