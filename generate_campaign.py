import json, re
from pathlib import Path
OUT=Path(r"C:\Users\adria\Documents\GitHub\b2-multiple-choice-cloze")
V={
"agent":["The hotel","The museum","The airline","The school","The company","The council","The office","The centre","The department","The agency","The team","The committee","The college","The clinic","The theatre","The library","The restaurant","The tour operator","The visitor centre","The research group","The booking team","The events team","The support team","The local authority"],
"person":["Marta","Daniel","Sara","Tom","Nina","Leo","Clara","Alex","Emma","Hugo","Lucy","Marc","Nora","Ben","Mia","Liam","Eva","Noah","Iris","Luke","Amy","Eric","Lea","Sam"],
"thing":["the report","the booking","the application","the form","the email","the project","the plan","the proposal","the document","the survey","the ticket","the reservation","the complaint","the request","the schedule","the contract","the message","the invoice","the presentation","the course","the meeting","the event","the website","the brochure"],
"topic":["the new schedule","the final report","the visitor survey","the booking system","the training course","the travel plan","the museum project","the hotel policy","the customer complaint","the safety rules","the event programme","the marketing plan","the online form","the flight change","the class project","the job application","the local campaign","the new website","the research results","the tour route","the staff meeting","the budget proposal","the service update","the exam timetable"],
"place":["the city centre","the airport","the station","the hotel","the museum","the office","the classroom","the library","the visitor centre","the theatre","the restaurant","the college","the clinic","the conference centre","the beach","the old town","the exhibition","the market","the harbour","the park","the campus","the terminal","the town hall","the gallery"],
"time":["today","this week","tomorrow","before Friday","next month","this morning","after lunch","before the meeting","during the course","this afternoon","next Monday","before the deadline","at the weekend","later today","before six","after the exam","this evening","next week","before the trip","during the project","before opening","after the tour","before class","at the end of the day"],
"activity":["working abroad","studying online","travelling alone","speaking in public","meeting visitors","using the new system","working under pressure","learning vocabulary","planning events","dealing with complaints","booking flights","writing reports","working in teams","using public transport","organising tours","handling bookings","answering emails","preparing presentations","helping customers","studying at night","working weekends","learning languages","managing projects","giving directions"],
"object":["the suitcase","the box","the equipment","the bag","the package","the chair","the screen","the table","the sign","the door","the parcel","the case","the folder","the camera","the printer","the lamp","the bicycle","the trolley","the suitcase","the display","the barrier","the notice","the shelf","the luggage"],
"area":["English","customer service","tourism","project work","exam practice","writing","speaking","research","planning","teamwork","technology","local history","visitor care","booking skills","presentation skills","grammar","vocabulary","communication","time management","digital skills","report writing","travel planning","event management","public speaking"],
"number":["two","three","four","five","six","seven","eight","nine","ten","twelve","fifteen","twenty","twenty-five","thirty","forty","fifty","sixty","seventy","eighty","ninety","one hundred","two hundred","three hundred","five hundred"]
}
V["person"] += ['Pau', 'Jan', 'Nil', 'Pol', 'Joan', 'Luis', 'Dani', 'Alba', 'Laia', 'Júlia', 'Aina', 'Ona', 'Mar', 'Roc', 'Biel', 'Iker', 'Iván', 'Omar', 'Teo', 'Raúl', 'Javi', 'Gabi', 'Enzo', 'Gael', 'Joel', 'Ari', 'Max', 'Ian', 'Dan', 'Eli', 'Luca', 'Adam', 'Jack', 'Owen', 'Ryan', 'Paul', 'Nico', 'Zoe', 'Lisa', 'Luna', 'Ava', 'Ivy', 'May', 'Lia', 'Noa', 'Elsa', 'Alma', 'Kim', 'Lee', 'Remy', 'Riley', 'Casey', 'Jamie', 'Robin', 'Sky']
V["bookable"]=["a room","the tickets","a table","a guided tour","a flight","a hotel room","the excursion","a seat","the museum tickets","the train tickets","a transfer","the accommodation","a city tour","the entrance tickets","a meeting room","a rental car","the return flight","a restaurant table","the airport transfer","a walking tour","a coach ticket","the theatre seats","a hostel room","the ferry tickets"]
V["effectarea"]=["your concentration","your performance","your memory","your mood","your sleep","your confidence","your attention","your reaction time","your decision-making","your energy","your motivation","your productivity","your pronunciation","your fluency","your accuracy","your results","your work","your studies","your health","your routine","your focus","your progress","your judgement","your learning"]
DOMAINS=["work","travel","study","tourism","services","daily"]
def B(q,a,c,rule,trigger,keys=("agent",)): return {"q":q,"a":a,"c":c,"rule":rule,"trigger":trigger,"keys":keys}
SKILLS={}
SKILLS["articles"]=("Part 2 · Articles · a/an/the/Ø",[
B("{agent} has ___ excellent reputation for service.",["an","a","the","—"],0,"Use an before a singular noun phrase beginning with a vowel sound.","A/AN/THE/Ø",("agent",)),
B("{agent} is close to ___ airport.",["an","a","the","—"],0,"Use an with a singular countable noun beginning with a vowel sound when it is not specific.","A/AN/THE/Ø",("agent",)),
B("{person} plays ___ guitar in a local group.",["the","a","an","—"],0,"Use the with musical instruments in this general pattern.","THE + MUSICAL INSTRUMENT",("person",)),
B("{person} usually has ___ breakfast before work.",["—","the","a","an"],0,"Meals normally take no article when used generally.","Ø + MEALS",("person",)),
B("{agent} is ___ largest one in the area.",["the","a","an","—"],0,"Superlatives normally take the.","THE + SUPERLATIVE",("agent",))])
SKILLS["quantifiers"]=("Part 2 · Quantifiers · much/many/few/little",[
B("There aren't ___ seats left at {place}.",["many","much","little","a little"],0,"Use many with plural countable nouns.","MANY + COUNTABLE PLURAL",("place",)),
B("We have very ___ time before {time}.",["little","few","many","a few"],0,"Use little with uncountable nouns such as time.","LITTLE + UNCOUNTABLE",("time",)),
B("Only a ___ people understood {topic}.",["few","little","much","amount"],0,"Use a few with plural countable nouns.","A FEW + COUNTABLE PLURAL",("topic",)),
B("A large ___ of visitors use {place}.",["number","amount","quantity","level"],0,"Use number of with plural countable nouns.","NUMBER OF + PLURAL",("place",)),
B("We received a small ___ of information about {topic}.",["amount","number","count","total"],0,"Use amount of with uncountable nouns.","AMOUNT OF + UNCOUNTABLE",("topic",))])
SKILLS["verb_prepositions"]=("Part 1/2 · Verb + preposition",[
B("{person} relies ___ public transport to get to {place}.",["on","in","at","for"],0,"Rely is followed by on.","RELY ON",("person","place")),
B("{person} insisted ___ checking {thing}.",["on","in","at","for"],0,"Insist is followed by on + -ing.","INSIST ON + -ING",("person","thing")),
B("{person} succeeded ___ completing {thing}.",["in","on","at","with"],0,"Succeed is followed by in + -ing.","SUCCEED IN + -ING",("person","thing")),
B("{person} recovered ___ the problem quickly.",["from","of","with","after"],0,"Recover is followed by from.","RECOVER FROM",("person",)),
B("How does {person} cope ___ {activity}?",["with","to","for","against"],0,"Cope is followed by with.","COPE WITH",("person","activity"))])
SKILLS["adjective_prepositions"]=("Part 1/2 · Adjective + preposition",[
B("{person} is responsible ___ {thing}.",["for","of","to","with"],0,"Responsible is followed by for.","RESPONSIBLE FOR",("person","thing")),
B("{person} is capable ___ {activity}.",["of","to","for","with"],0,"Capable is followed by of + noun/-ing.","CAPABLE OF",("person","activity")),
B("{person} is familiar ___ {topic}.",["with","to","of","about"],0,"Familiar is followed by with.","FAMILIAR WITH",("person","topic")),
B("{person} wasn't aware ___ {topic}.",["of","about","for","to"],0,"Aware is followed by of.","AWARE OF",("person","topic")),
B("{person} is interested ___ {activity}.",["in","on","at","for"],0,"Interested is followed by in.","INTERESTED IN",("person","activity"))])
# v1.1: six redundant Grammar/Phrasal blocks are repurposed for B2 First Part 1/2.
# Lexical inventories were calibrated against our adaptive-exam EngExam/Cambridge bank;
# the sentences below are original training items rather than copied exam text.
SKILLS["verb_ing"]=("Part 1 · point / aim / purpose / reason",[
B("There's no ___ in discussing {topic} again.",["point","aim","purpose","reason"],0,"The fixed pattern is there is no point in + -ing.","NO POINT IN + -ING",("topic",)),
B("{person}'s main ___ is to improve their English.",["aim","point","reason","profit"],0,"Aim is a goal or objective someone wants to achieve.","MAIN AIM",("person",)),
B("{agent} introduced the change for the ___ of improving {area}.",["purpose","point","aim","profit"],0,"For the purpose of means with the intention of doing something.","FOR THE PURPOSE OF",("agent","area")),
B("For this ___, {person} checked {thing} twice.",["reason","aim","point","purpose"],0,"For this reason introduces the cause or explanation for an action.","FOR THIS REASON",("person","thing")),
B("The whole ___ of {thing} is to make the process easier.",["point","profit","reason","cause"],0,"The point of something is its main purpose.","THE POINT OF",("thing",))])
SKILLS["verb_to"]=("Part 1 · experience / knowledge / awareness / understanding",[
B("{person} gained valuable ___ while working abroad.",["experience","knowledge","awareness","understanding"],0,"Gain experience is the natural collocation for practical learning through doing.","GAIN EXPERIENCE",("person",)),
B("{agent} wants to raise ___ of {topic}.",["awareness","experience","knowledge","understanding"],0,"Raise awareness is the fixed collocation for making people more conscious of an issue.","RAISE AWARENESS",("agent","topic")),
B("{person} has a good ___ of how {thing} works.",["understanding","experience","awareness","occasion"],0,"Have a good understanding of means comprehend how something works.","UNDERSTANDING OF",("person","thing")),
B("{person} has detailed ___ of {area}.",["knowledge","experience","awareness","feeling"],0,"Knowledge of refers to information or understanding someone possesses about a subject.","KNOWLEDGE OF",("person","area")),
B("{person} has no previous ___ of working with visitors.",["experience","knowledge","awareness","sense"],0,"Experience of + -ing refers to practical previous involvement.","EXPERIENCE OF + -ING",("person",))])
SKILLS["bare_infinitive"]=("Part 1 · detail / aspect / issue / matter",[
B("{person} remembered every ___ of {thing}.",["detail","aspect","issue","matter"],0,"A detail is a small individual fact or feature.","EVERY DETAIL",("person","thing")),
B("The report examines several ___ of {area}.",["aspects","details","issues","matters"],0,"An aspect is one particular part or feature of a subject.","ASPECTS OF",("area",)),
B("For {person}, {topic} has become a major ___.",["issue","detail","aspect","subject"],0,"A major issue is an important problem or matter for discussion.","MAJOR ISSUE",("person","topic")),
B("That's a private ___ for {person}.",["matter","aspect","detail","topic"],0,"A private matter is a personal subject or situation.","PRIVATE MATTER",("person",)),
B("The guide went into great ___ about {topic}.",["detail","matter","issue","aspect"],0,"Go into detail means explain something thoroughly.","GO INTO DETAIL",("topic",))])
SKILLS["phrasal_get_take"]=("Part 1 · chance / opportunity / prospect / occasion",[
B("{person} was given the ___ to work on a local project.",["opportunity","chance","occasion","prospect"],0,"Be given the opportunity to means receive a suitable chance to do something.","OPPORTUNITY TO",("person",)),
B("By any ___, did {person} mention {topic}?",["chance","opportunity","occasion","prospect"],0,"By any chance is a fixed expression used when asking whether something might be true.","BY ANY CHANCE",("person","topic")),
B("{person} was excited by the ___ of working abroad.",["prospect","occasion","chance","opportunity"],0,"The prospect of something is the possibility of it happening, especially when it causes a feeling.","THE PROSPECT OF",("person",)),
B("On this ___, {person} decided to visit {place}.",["occasion","chance","opportunity","prospect"],0,"On this occasion refers to a particular event or instance.","ON THIS OCCASION",("person","place")),
B("{person} took the ___ to ask about {topic}.",["opportunity","occasion","prospect","possibility"],0,"Take the opportunity to means use a suitable moment to do something.","TAKE THE OPPORTUNITY TO",("person","topic"))])
SKILLS["phrasal_put_set"]=("Part 1 · habit / tendency / trend / custom",[
B("{person} has a ___ to speak too quickly when nervous.",["tendency","habit","custom","trend"],0,"Have a tendency to means be likely to behave in a particular way.","TENDENCY TO",("person",)),
B("For {person}, welcoming visitors in this way is a ___.",["custom","habit","trend","tendency"],0,"A custom is an established traditional way of behaving in a group or place.","LOCAL CUSTOM",("person",)),
B("{person} is in the ___ of checking every booking twice.",["habit","custom","trend","tendency"],0,"Be in the habit of + -ing describes a regular personal behaviour.","IN THE HABIT OF",("person",)),
B("There is a growing ___ towards shorter trips to {place}.",["trend","custom","habit","tendency"],0,"A trend towards something is a general direction in which behaviour is changing.","TREND TOWARDS",("place",)),
B("{person} checked {thing} again out of ___.",["habit","custom","trend","tendency"],0,"Out of habit means because something is done automatically and regularly.","OUT OF HABIT",("person","thing"))])
SKILLS["phrasal_look_come"]=("Part 2 · Open Cloze core",[
B("{agent}, ___ introduced a new service recently, has received good reviews.",["which","what","where","who"],0,"Which introduces a non-defining relative clause referring to a thing or organisation.","WHICH + CLAUSE",("agent",)),
B("{person} asked ___ we had visited {place} before.",["whether","which","what","whose"],0,"Whether introduces an indirect yes/no question.","WHETHER + CLAUSE",("person","place")),
B("The tickets have already ___ sent to {person}.",["been","being","be","were"],0,"The present perfect passive is have/has been + past participle.","HAVE BEEN + PARTICIPLE",("person",)),
B("The trip was much cheaper ___ {person} expected.",["than","that","as","like"],0,"Than follows a comparative such as cheaper.","COMPARATIVE + THAN",("person",)),
B("This is the café ___ {person} met the guide.",["where","which","what","who"],0,"Where introduces a relative clause referring to a place.","PLACE + WHERE",("person",))])
SKILLS["phrasal_general"]=("Part 1 · Phrasal verbs · exam essentials",[
B("{agent} had to ___ the event because of the weather.",["call off","call out","call up","call in"],0,"Call off means cancel.","CALL OFF",("agent",)),
B("{agent} will ___ further tests on {topic}.",["carry out","carry on","carry off","carry over"],0,"Carry out means perform or conduct.","CARRY OUT",("agent","topic")),
B("{person} wants to ___ what happened to {thing}.",["find out","find up","find over","find off"],0,"Find out means discover information.","FIND OUT",("person","thing")),
B("We may ___ water before reaching {place}.",["run out of","run away from","run off with","run down on"],0,"Run out of means use all of something.","RUN OUT OF",("place",)),
B("{thing} turned ___ to be more useful than expected.",["out","up","over","off"],0,"Turn out means prove to be.","TURN OUT",("thing",))])
SKILLS["colloc_make_do"]=("Part 1 · Collocations · make/do",[
B("{agent} needs to ___ a decision about {topic}.",["make","do","take","have"],0,"The collocation is make a decision.","MAKE A DECISION",("agent","topic")),
B("{person} has made good ___ in {area}.",["progress","advance","movement","development"],0,"The fixed collocation is make progress.","MAKE PROGRESS",("person","area")),
B("{agent} is doing ___ on {topic}.",["research","an investigation of","a study to","information"],0,"The standard collocation is do research.","DO RESEARCH",("agent","topic")),
B("The storm did serious ___ to {place}.",["damage","harmful","break","effect"],0,"The collocation is do damage.","DO DAMAGE",("place",)),
B("{agent} does a lot of ___ with local companies.",["business","workings","trade work","deal"],0,"The collocation is do business with.","DO BUSINESS",("agent",))])
SKILLS["colloc_take_have"]=("Part 1 · Collocations · take/have",[
B("{person} should ___ advantage of the free course.",["take","have","make","do"],0,"The expression is take advantage of.","TAKE ADVANTAGE OF",("person",)),
B("{person} plans to ___ part in the event.",["take","have","make","do"],0,"The expression is take part in.","TAKE PART IN",("person",)),
B("The meeting will ___ place at {place}.",["take","have","make","do"],0,"The expression is take place.","TAKE PLACE",("place",)),
B("{person} had difficulty ___ {thing}.",["understanding","to understand","understand","understood"],0,"Have difficulty is followed by -ing.","HAVE DIFFICULTY + -ING",("person","thing")),
B("{topic} may have an ___ on the final decision.",["effect","affect","impacting","result to"],0,"Have an effect on is a standard collocation.","HAVE AN EFFECT ON",("topic",))])
SKILLS["colloc_verb_noun"]=("Part 1 · Collocations · verb + noun",[
B("{agent} wants to ___ awareness of {topic}.",["raise","rise","lift","grow"],0,"The collocation is raise awareness.","RAISE AWARENESS",("agent","topic")),
B("The two sides finally ___ an agreement on {topic}.",["reached","arrived","achieved","met"],0,"The collocation is reach an agreement.","REACH AN AGREEMENT",("topic",)),
B("{thing} failed to ___ our expectations.",["meet","reach","fill","complete"],0,"The collocation is meet expectations.","MEET EXPECTATIONS",("thing",)),
B("The report ___ attention to {topic}.",["draws","pulls","takes","brings"],0,"The collocation is draw attention to.","DRAW ATTENTION TO",("topic",)),
B("{person} gained valuable ___ through {activity}.",["experience","practice","knowledge","skill"],0,"The collocation is gain experience.","GAIN EXPERIENCE",("person","activity"))])
SKILLS["colloc_adverb"]=("Part 1 · Adverb + adjective collocations",[
B("{person} is deeply ___ about {topic}.",["concerned","worriedly","serious","careful"],0,"Deeply concerned is a common collocation.","DEEPLY CONCERNED",("person","topic")),
B("{thing} is widely ___ online.",["available","possible","openly","free"],0,"Widely available is a common collocation.","WIDELY AVAILABLE",("thing",)),
B("{topic} is closely ___ to the main issue.",["related","joined","near","attached"],0,"Closely related is the natural collocation.","CLOSELY RELATED",("topic",)),
B("Booking early is strongly ___ for visits to {place}.",["recommended","advised to","suggested to","preferred"],0,"Strongly recommended is a standard collocation.","STRONGLY RECOMMENDED",("place",)),
B("{person} was highly ___ with the service.",["satisfied","pleasing","gladly","contented by"],0,"Highly satisfied is a standard collocation.","HIGHLY SATISFIED",("person",))])
SKILLS["fixed_in"]=("Part 1/2 · Fixed expressions · in",[
B("Please book {bookable} in ___.",["advance","front","before","ahead"],0,"The fixed expression is in advance.","IN ADVANCE",("bookable",)),
B("{person} is in ___ of {thing}.",["charge","control","care","responsibility"],0,"The fixed expression is in charge of.","IN CHARGE OF",("person","thing")),
B("We went to {place} in ___ of the rain.",["spite","case","front","place"],0,"The fixed expression is in spite of.","IN SPITE OF",("place",)),
B("{person} and I have a lot in ___.",["common","same","together","similar"],0,"The fixed expression is have something in common.","IN COMMON",("person",)),
B("This change to {topic} may save money in the long ___.",["run","term","way","future"],0,"The fixed expression is in the long run.","IN THE LONG RUN",("topic",))])
SKILLS["fixed_at_on_by"]=("Part 1/2 · Fixed expressions · at/on/by",[
B("We need at ___ {number} volunteers.",["least","less","last","minimum"],0,"The fixed expression is at least.","AT LEAST",("number",)),
B("{thing} is at ___ of being cancelled.",["risk","danger","chance","threat"],0,"The fixed expression is at risk of.","AT RISK OF",("thing",)),
B("{person} did it on ___.",["purpose","reason","intention","aim"],0,"The fixed expression is on purpose.","ON PURPOSE",("person",)),
B("On ___, visitors spend an hour at {place}.",["average","mean","general","normal"],0,"The fixed expression is on average.","ON AVERAGE",("place",)),
B("{thing} is by ___ the best option.",["far","much","long","way"],0,"The fixed expression is by far.","BY FAR",("thing",))])
SKILLS["say_tell_speak_talk"]=("Part 1 · Say / tell / speak / talk",[
B("Please ___ me what happened to {thing}.",["tell","say","speak","talk"],0,"Tell is used directly with a person: tell me.","TELL + PERSON",("thing",)),
B("{person} didn't ___ anything about {topic}.",["say","tell","speak","talk"],0,"Say can be followed by the thing said without a personal object.","SAY SOMETHING",("person","topic")),
B("{person} can ___ English very well.",["speak","say","tell","talk"],0,"Speak is used for languages.","SPEAK + LANGUAGE",("person",)),
B("We need to ___ about {topic}.",["talk","say","tell","speak to"],0,"Talk about is the natural expression for discussing a topic informally.","TALK ABOUT",("topic",)),
B("Can {person} ___ the difference between the two options?",["tell","say","speak","talk"],0,"Tell the difference is a fixed expression.","TELL THE DIFFERENCE",("person",))])
SKILLS["travel_words"]=("Part 1 · Travel words · journey/trip/travel/tour/route",[
B("The train ___ to {place} took three hours.",["journey","travel","trip","tour"],0,"Journey refers to the act of travelling from one place to another.","TRAIN JOURNEY",("place",)),
B("{person} is away on a business ___.",["trip","journey","travel","route"],0,"Trip is used for a journey and stay, especially for a purpose.","BUSINESS TRIP",("person",)),
B("Air ___ to {place} has become cheaper in recent years.",["travel","journey","trip","tour"],0,"Travel is the general uncountable noun for the activity.","AIR TRAVEL",("place",)),
B("We joined a guided ___ of {place}.",["tour","journey","travel","route"],0,"A tour is an organised visit around a place.","GUIDED TOUR",("place",)),
B("This bus ___ goes past {place}.",["route","journey","travel","tour"],0,"Route is the path followed between places.","BUS ROUTE",("place",))])
SKILLS["work_job_career"]=("Part 1 · Work / job / career / profession / business",[
B("{person} has a lot of ___ to finish {time}.",["work","job","career","profession"],0,"Work is normally uncountable when referring to tasks in general.","WORK = UNCOUNTABLE TASKS",("person","time")),
B("{person} applied for a ___ at {agent}.",["job","work","career","business"],0,"A job is a specific paid position.","APPLY FOR A JOB",("person","agent")),
B("{person} wants a ___ in tourism.",["career","jobbing","workplace","professionally"],0,"Career describes a long-term working life in a field.","CAREER IN",("person",)),
B("{person} sees teaching as a demanding ___.",["profession","career pathing","job work","business"],0,"Profession refers to an occupation requiring specialised training.","PROFESSION",("person",)),
B("{person} runs a small ___.",["business","work","job","career"],0,"Run a business is the natural expression.","RUN A BUSINESS",("person",))])
SKILLS["raise_rise_grow"]=("Part 1 · Raise / rise / grow / lift / arise",[
B("Prices may ___ again {time}.",["rise","raise","lift","arise"],0,"Rise is intransitive: prices rise by themselves.","PRICES RISE",("time",)),
B("{agent} may ___ prices {time}.",["raise","rise","arise","grow"],0,"Raise is transitive and needs an object.","RAISE + OBJECT",("agent","time")),
B("The number of visitors to {place} continues to ___.",["grow","raise","lift","arise"],0,"Grow can mean increase gradually.","GROW = INCREASE",("place",)),
B("{person} couldn't ___ {object} alone.",["lift","rise","raise up","arise"],0,"Lift means physically move something upwards.","LIFT + OBJECT",("person","object")),
B("Problems may ___ if {topic} is ignored.",["arise","raise","rise up","lift"],0,"Arise means occur or begin to exist, especially for problems.","PROBLEMS ARISE",("topic",))])
SKILLS["remember_remind"]=("Part 1 · Remember / remind / recall / recognise / realise",[
B("{person} must remember ___ {thing}.",["to check","checking","reminding","to recall"],0,"Remember to do means not forget a future action.","REMEMBER TO + VERB",("person","thing")),
B("Please ___ {person} to bring {thing}.",["remind","remember","recall","recognise"],0,"Remind someone to do something means make them remember.","REMIND + PERSON + TO",("person","thing")),
B("{person} can clearly ___ meeting the guide.",["recall","remind","recognise","realise"],0,"Recall means remember a past event or fact.","RECALL + MEMORY",("person",)),
B("{person} didn't ___ the man from the photo.",["recognise","remember to","remind","realise of"],0,"Recognise means identify someone or something seen before.","RECOGNISE",("person",)),
B("{person} suddenly ___ that {thing} was missing.",["realised","recognised","reminded","recalled to"],0,"Realise means become aware of a fact.","REALISE + CLAUSE",("person","thing"))])
SKILLS["look_see_watch"]=("Part 1 · Look / see / watch / notice / observe",[
B("{person} stopped to ___ at the map.",["look","see","watch","notice"],0,"Look at means direct your eyes deliberately.","LOOK AT",("person",)),
B("{person} needs to ___ a doctor {time}.",["see","look","watch","observe"],0,"See a doctor is the normal expression for visiting a doctor.","SEE A DOCTOR",("person","time")),
B("{person} wants to ___ the film {time}.",["watch","look","see at","notice"],0,"Watch is used for something viewed over a period of time.","WATCH A FILM",("person","time")),
B("{person} didn't ___ the change in {thing}.",["notice","watch","look","observe at"],0,"Notice means become aware of something.","NOTICE A CHANGE",("person","thing")),
B("Researchers ___ how visitors use {place}.",["observe","watch at","look","see to"],0,"Observe means watch carefully, often for study.","OBSERVE BEHAVIOUR",("place",))])
SKILLS["general_confusables"]=("Part 1 · Common B2 confusables",[
B("Lack of sleep can ___ {effectarea}.",["affect","effect","result","cause to"],0,"Affect is usually the verb meaning influence.","AFFECT = VERB",("effectarea",)),
B("Can {person} ___ my pen {time}?",["borrow","lend","hire","rent"],0,"Borrow means take and use something that belongs to someone else.","BORROW FROM",("person","time")),
B("It would be ___ to check {thing} first.",["sensible","sensitive","serious","aware"],0,"Sensible means practical and reasonable; sensitive means easily affected.","SENSIBLE = PRACTICAL",("thing",)),
B("{person} will ___ the workshop {time}.",["attend","assist","visit to","take"],0,"Attend means be present at an event; assist usually means help.","ATTEND AN EVENT",("person","time")),
B("{person} felt ___ after moving away.",["lonely","alone","single","only"],0,"Lonely describes the unhappy feeling of being without company.","LONELY = FEELING",("person",))])
SKILLS["connectors"]=("Part 2 · Connectors · clause or noun?",[
B("___ the heavy rain, we went to {place}.",["Despite","Although","Because","While"],0,"Despite is followed by a noun or -ing form.","DESPITE + NOUN",("place",)),
B("___ it was raining, {person} went out.",["Although","Despite","Because of","During"],0,"Although is followed by a full clause.","ALTHOUGH + CLAUSE",("person",)),
B("{person}'s trip was delayed ___ the weather.",["because of","because","although","unless"],0,"Because of is followed by a noun phrase.","BECAUSE OF + NOUN",("person",)),
B("We won't finish {thing} ___ everyone helps.",["unless","if","while","during"],0,"Unless means if not and introduces a condition.","UNLESS = IF NOT",("thing",)),
B("{person} took notes ___ the meeting.",["during","while","since","for"],0,"During is followed by a noun; while is followed by a clause.","DURING + NOUN",("person",))])
EXTRAS={
"articles":[
B("{person} wants to become ___ engineer.",["an","a","the","—"],0,"Use an before a singular profession beginning with a vowel sound.","AN + VOWEL SOUND",("person",)),
B("It was ___ first time {person} had flown alone.",["the","a","an","—"],0,"Use the in the fixed pattern the first time.","THE FIRST TIME",("person",)),
B("{person} usually travels by ___ train.",["—","the","a","an"],0,"Means of transport after by normally take no article.","BY + Ø TRANSPORT",("person",)),
B("{person} lives close to ___ sea.",["the","a","an","—"],0,"Use the with the sea in this general geographical expression.","THE SEA",("person",)),
B("{agent} needs ___ new manager.",["a","an","the","—"],0,"Use a for one non-specific singular countable noun beginning with a consonant sound.","A + SINGULAR",("agent",))],
"quantifiers":[
B("There is too ___ traffic near {place}.",["much","many","few","a few"],0,"Use much with uncountable nouns such as traffic.","MUCH + UNCOUNTABLE",("place",)),
B("Very ___ visitors complained at {place}.",["few","little","much","a little"],0,"Use few with plural countable nouns.","FEW + PLURAL",("place",)),
B("{person} has only a ___ money left.",["little","few","many","much"],0,"A little is used with uncountable nouns to mean some.","A LITTLE + UNCOUNTABLE",("person",)),
B("Not ___ people knew about {topic}.",["many","much","little","amount"],0,"Use many with plural countable nouns.","MANY + PEOPLE",("topic",)),
B("How ___ information did {person} receive?",["much","many","few","number"],0,"Use much with the uncountable noun information.","MUCH INFORMATION",("person",))],
"verb_prepositions":[
B("{person} depends ___ the bus to reach {place}.",["on","in","at","for"],0,"Depend is followed by on.","DEPEND ON",("person","place")),
B("{person} apologised ___ the delay.",["for","of","with","to"],0,"Apologise is followed by for before a thing or action.","APOLOGISE FOR",("person",)),
B("{thing} belongs ___ {person}.",["to","with","for","at"],0,"Belong is followed by to.","BELONG TO",("thing","person")),
B("{person} participated ___ the workshop.",["in","on","at","for"],0,"Participate is followed by in.","PARTICIPATE IN",("person",)),
B("{person} suffered ___ a bad cold.",["from","of","with","by"],0,"Suffer is followed by from for an illness or problem.","SUFFER FROM",("person",))],
"adjective_prepositions":[
B("{person} is proud ___ the result.",["of","for","with","about"],0,"Proud is followed by of.","PROUD OF",("person",)),
B("{person} is keen ___ learning English.",["on","in","at","for"],0,"Keen is followed by on.","KEEN ON",("person",)),
B("{person} is afraid ___ missing the train.",["of","from","for","with"],0,"Afraid is followed by of.","AFRAID OF",("person",)),
B("{thing} is suitable ___ beginners.",["for","to","of","with"],0,"Suitable is followed by for.","SUITABLE FOR",("thing",)),
B("{thing} is similar ___ the old version.",["to","with","of","as"],0,"Similar is followed by to.","SIMILAR TO",("thing",))],
"verb_ing":[
B("What is the ___ of {thing}?",["point","aim","reason","profit"],0,"The point of something is its purpose or usefulness.","THE POINT OF",("thing",)),
B("{person}'s ___ is to pass the exam.",["aim","point","reason","matter"],0,"An aim is a goal someone wants to achieve.","AIM = GOAL",("person",)),
B("For no clear ___, {person} left early.",["reason","purpose","aim","point"],0,"A reason explains why something happens.","FOR A REASON",("person",)),
B("{thing} serves a useful ___.",["purpose","point","reason","aim"],0,"Serve a purpose means have a useful function.","SERVE A PURPOSE",("thing",)),
B("{person} joined with the ___ of improving English.",["aim","reason","point","profit"],0,"With the aim of is followed by -ing.","WITH THE AIM OF",("person",))],
"verb_to":[
B("{person} has years of practical ___.",["experience","awareness","knowledge","understanding"],0,"Experience is knowledge or skill gained by doing something.","PRACTICAL EXPERIENCE",("person",)),
B("{agent} hopes to increase public ___ of {topic}.",["awareness","experience","knowledge","understanding"],0,"Public awareness means how conscious people are of an issue.","PUBLIC AWARENESS",("agent","topic")),
B("{person}'s ___ of English is excellent.",["knowledge","experience","awareness","prospect"],0,"Knowledge of a subject means information and understanding of it.","KNOWLEDGE OF",("person",)),
B("{person} said the discussion improved mutual ___.",["understanding","awareness","experience","knowledge"],0,"Mutual understanding means shared comprehension between people.","MUTUAL UNDERSTANDING",("person",)),
B("{person} lacks ___ in customer service.",["experience","knowledge","awareness","occasion"],0,"Lack experience in means not have enough practical involvement.","EXPERIENCE IN",("person",))],
"bare_infinitive":[
B("One important ___ of {topic} is cost.",["aspect","detail","issue","matter"],0,"An aspect is one part or feature of a subject.","AN ASPECT OF",("topic",)),
B("It's only a minor ___, {person}.",["detail","issue","matter","aspect"],0,"A detail is a small fact or feature.","A MINOR DETAIL",("person",)),
B("{person} raised the ___ during the meeting.",["issue","detail","aspect","matter"],0,"Raise an issue means introduce a subject or problem for discussion.","RAISE AN ISSUE",("person",)),
B("For {person}, it is only a ___ of time.",["matter","issue","detail","aspect"],0,"A matter of time is a fixed expression.","A MATTER OF TIME",("person",)),
B("{person} explained {thing} in more ___.",["detail","matter","issue","aspect"],0,"In more detail means with more specific information.","IN MORE DETAIL",("person","thing"))],
"phrasal_get_take":[
B("{person} has little ___ of winning.",["chance","opportunity","occasion","prospect"],0,"Chance refers to how likely something is to happen.","CHANCE OF",("person",)),
B("{person} had a rare ___ to study abroad.",["opportunity","chance","occasion","prospect"],0,"An opportunity is a suitable chance to do something.","OPPORTUNITY TO",("person",)),
B("On one ___, {person} missed the train.",["occasion","chance","opportunity","prospect"],0,"On one occasion refers to one particular event.","ON ONE OCCASION",("person",)),
B("The ___ of rain worried {person}.",["prospect","chance","occasion","opportunity"],0,"The prospect of something is the possibility of it happening.","PROSPECT OF",("person",)),
B("{person} has every ___ of succeeding.",["chance","occasion","prospect","opportunity"],0,"Have every chance of means be very likely to succeed.","EVERY CHANCE OF",("person",))],
"phrasal_put_set":[
B("{person} noticed a new ___ towards shorter city breaks.",["trend","habit","custom","tendency"],0,"A trend is a general direction of change.","LATEST TREND",("person",)),
B("{person} has a bad ___ of checking messages late.",["habit","trend","custom","tendency"],0,"A habit is a repeated personal behaviour.","A BAD HABIT",("person",)),
B("{person} shows a strong ___ to rush.",["tendency","habit","custom","trend"],0,"A tendency is a likelihood to behave in a certain way.","TENDENCY TO",("person",)),
B("For {person}, this family ___ is important.",["custom","habit","trend","tendency"],0,"A custom is a traditional way of behaving in a group.","FAMILY CUSTOM",("person",)),
B("{person} is trying to break the ___.",["habit","trend","custom","tendency"],0,"Break the habit means stop a repeated behaviour.","BREAK THE HABIT",("person",))],
"phrasal_look_come":[
B("{person} has lived here ___ 2020.",["since","for","from","during"],0,"Since introduces the starting point of a continuing period.","SINCE + STARTING POINT",("person",)),
B("{person} won't leave ___ the rain stops.",["until","during","for","since"],0,"Until means up to the time when something happens.","UNTIL + CLAUSE",("person",)),
B("{person} helped the visitor ___ bag was missing.",["whose","who","which","what"],0,"Whose expresses possession in a relative clause.","WHOSE + NOUN",("person",)),
B("{person} didn't know ___ the message meant.",["what","which","that","whose"],0,"What introduces the thing or meaning being asked about.","WHAT + CLAUSE",("person",)),
B("It was ___ cold that {person} stayed inside.",["so","such","too","enough"],0,"Use so + adjective + that.","SO + ADJECTIVE + THAT",("person",))],
"phrasal_general":[
B("{person} will ___ early for {place}.",["set off","set up","set out of","set down"],0,"Set off means begin a journey.","SET OFF",("person","place")),
B("{person} had to ___ the offer.",["turn down","turn out","turn over","turn up"],0,"Turn down means refuse an offer.","TURN DOWN",("person",)),
B("{person} will ___ the tickets at {place}.",["pick up","pick out","pick over","pick off"],0,"Pick up means collect something.","PICK UP",("person","place")),
B("{person} agreed to ___ the children.",["look after","look into","look over","look up"],0,"Look after means take care of someone.","LOOK AFTER",("person",)),
B("{person} didn't want to ___ the problem again.",["bring up","bring out","bring off","bring over"],0,"Bring up means introduce a topic for discussion.","BRING UP",("person",))],
"colloc_make_do":[
B("{person} made an ___ to arrive early.",["effort","attempting","work","action"],0,"Make an effort is a fixed collocation.","MAKE AN EFFORT",("person",)),
B("Could {person} do me a ___?",["favour","help","service to","support"],0,"Do someone a favour is a fixed collocation.","DO A FAVOUR",("person",)),
B("{person} made a small ___ in {thing}.",["mistake","fault","damage","wrong"],0,"Make a mistake is the standard collocation.","MAKE A MISTAKE",("person","thing")),
B("{person} did their ___ in the interview.",["best","better","effort","maximum"],0,"Do your best is a fixed expression.","DO YOUR BEST",("person",)),
B("{person} thinks a small change can make a big ___.",["difference","effecting","change of","resulting"],0,"Make a difference is a fixed collocation.","MAKE A DIFFERENCE",("person",))],
"colloc_take_have":[
B("{person} must take ___ for the mistake.",["responsibility","charge","duty","control"],0,"Take responsibility for is a fixed collocation.","TAKE RESPONSIBILITY",("person",)),
B("{person} has a good ___ of getting the job.",["chance","occasion","prospect to","opportunity of"],0,"Have a good chance of means be likely to succeed.","HAVE A CHANCE OF",("person",)),
B("{person} takes great ___ with every booking.",["care","attention to","notice","caution of"],0,"Take care with means act carefully.","TAKE CARE WITH",("person",)),
B("{person} had ___ understanding the instructions.",["trouble","difficulty to","problem to","hard"],0,"Have trouble + -ing is a common pattern.","HAVE TROUBLE + -ING",("person",)),
B("{person} took no ___ of the warning.",["notice","attention","care","view"],0,"Take notice of means pay attention to something.","TAKE NOTICE OF",("person",))],
"colloc_verb_noun":[
B("{person} hopes to ___ an ambition this year.",["fulfil","complete","finish","perform"],0,"Fulfil an ambition is a standard collocation.","FULFIL AN AMBITION",("person",)),
B("{person} drew the wrong ___ from the email.",["conclusion","result","ending","decision"],0,"Draw a conclusion is a fixed collocation.","DRAW A CONCLUSION",("person",)),
B("{person} paid close ___ to the instructions.",["attention","notice","care","interest"],0,"Pay attention to is a fixed collocation.","PAY ATTENTION TO",("person",)),
B("{topic} has raised serious ___.",["concern","worrying","attention","danger"],0,"Raise concern is a standard collocation.","RAISE CONCERN",("topic",)),
B("{thing} meets every legal ___.",["requirement","request","need to","demanding"],0,"Meet a requirement is a standard collocation.","MEET A REQUIREMENT",("thing",))],
"colloc_adverb":[
B("It is highly ___ that {person} will be late.",["unlikely","impossiblely","doubtfuly","rare"],0,"Highly unlikely is a common collocation.","HIGHLY UNLIKELY",("person",)),
B("{person} was fully ___ of the risk.",["aware","known","noticed","consciousness"],0,"Fully aware is a common collocation.","FULLY AWARE",("person",)),
B("{person} was deeply ___ by the result.",["disappointed","sadly","unhappyly","regretting"],0,"Deeply disappointed is a common collocation.","DEEPLY DISAPPOINTED",("person",)),
B("{topic} is closely ___ to tourism.",["connected","joined","near","attached at"],0,"Closely connected is a natural collocation.","CLOSELY CONNECTED",("topic",)),
B("{person} is widely ___ in the industry.",["recognised","known about","seen to","noticed by"],0,"Widely recognised is a common collocation.","WIDELY RECOGNISED",("person",))],
"fixed_in":[
B("{person} took an umbrella in ___ it rained.",["case","fact","time","place"],0,"In case introduces a precaution for a possible event.","IN CASE",("person",)),
B("In ___, {person} had already paid.",["fact","case","general","particular"],0,"In fact introduces a true or clarifying statement.","IN FACT",("person",)),
B("{person} says that in ___, visitors prefer short tours.",["general","fact","case","time"],0,"In general means usually or overall.","IN GENERAL",("person",)),
B("{person} liked one option in ___.",["particular","general","fact","case"],0,"In particular singles out one thing.","IN PARTICULAR",("person",)),
B("{person} arrived just in ___ for the train.",["time","case","advance","fact"],0,"In time means early enough for something.","IN TIME",("person",))],
"fixed_at_on_by":[
B("{person} found the file by ___.",["accident","purpose","chance of","mistake to"],0,"By accident means unintentionally.","BY ACCIDENT",("person",)),
B("{person} spoke on ___ of the team.",["behalf","account","place","side"],0,"On behalf of means representing someone or a group.","ON BEHALF OF",("person",)),
B("At ___, {person} found the task difficult.",["first","least","last","once"],0,"At first means at the beginning.","AT FIRST",("person",)),
B("{person} met the guide by ___.",["chance","purpose","occasion","luckily"],0,"By chance means accidentally or unexpectedly.","BY CHANCE",("person",)),
B("{person} arrived exactly on ___.",["time","hour","schedule at","moment"],0,"On time means at the planned time.","ON TIME",("person",))],
"say_tell_speak_talk":[
B("{person} stopped to ___ hello.",["say","tell","speak","talk"],0,"Say is used with words such as hello.","SAY HELLO",("person",)),
B("{person} promised to ___ the truth.",["tell","say","speak","talk"],0,"Tell the truth is a fixed collocation.","TELL THE TRUTH",("person",)),
B("{person} will ___ to the manager.",["speak","say","tell","talk about"],0,"Speak to someone is natural in a more formal context.","SPEAK TO",("person",)),
B("{person} wants to ___ about {topic} later.",["talk","tell","say","speak about to"],0,"Talk about is used for an informal discussion.","TALK ABOUT",("person","topic")),
B("{person} told me ___ the delay.",["about","of to","for","with"],0,"Tell someone about something is a standard pattern.","TELL SOMEONE ABOUT",("person",))],
"travel_words":[
B("{place} was our final ___.",["destination","journey","route","tour"],0,"A destination is the place a journey ends.","FINAL DESTINATION",("place",)),
B("{person}'s return ___ took four hours.",["journey","travel","tour","route"],0,"Journey refers to travelling from one place to another.","RETURN JOURNEY",("person",)),
B("{person} went on a business ___.",["trip","travel","route","journeying"],0,"Business trip is the standard expression.","BUSINESS TRIP",("person",)),
B("{person} thinks rail ___ is cheaper than flying.",["travel","journey","trip","tour"],0,"Travel is the uncountable noun for the activity in general.","RAIL TRAVEL",("person",)),
B("{person} joined a walking ___ of {place}.",["tour","travel","journey","route"],0,"A tour is an organised visit around a place.","WALKING TOUR",("person","place"))],
"work_job_career":[
B("{person} works hard to earn a ___.",["living","job","career","profession"],0,"Earn a living means earn enough money to live.","EARN A LIVING",("person",)),
B("{person} found a part-time ___.",["job","work","career","business"],0,"A job is a specific paid position.","PART-TIME JOB",("person",)),
B("{person} is considering a career ___.",["change","job","work","profession"],0,"Career change is a standard expression.","CAREER CHANGE",("person",)),
B("{person} says medicine is a demanding ___.",["profession","jobbing","business","workplace"],0,"Profession is an occupation requiring specialised training.","A PROFESSION",("person",)),
B("{person} helps run the family ___.",["business","work","career","profession"],0,"Family business is a standard expression.","FAMILY BUSINESS",("person",))],
"raise_rise_grow":[
B("{person} says temperatures may ___ tomorrow.",["rise","raise","grow up","lift"],0,"Rise is intransitive: temperatures rise by themselves.","TEMPERATURES RISE",("person",)),
B("{person} wants to ___ a question.",["raise","rise","grow","arise"],0,"Raise is transitive and can mean introduce a question.","RAISE A QUESTION",("person",)),
B("{person} says children ___ quickly in early years.",["grow","raise","rise","lift"],0,"Grow means become bigger or develop.","CHILDREN GROW",("person",)),
B("{agent} may ___ the ban next week.",["lift","raise up","rise","arise"],0,"Lift a ban means officially end a restriction.","LIFT A BAN",("agent",)),
B("A new problem ___ during {person}'s meeting.",["arose","raised","rose up","lifted"],0,"Arise means begin to exist or occur.","A PROBLEM AROSE",("person",))],
"remember_remind":[
B("{person} remembers ___ the guide before.",["meeting","to meet","meet","met"],0,"Remember doing refers to a memory of a past action.","REMEMBER + -ING",("person",)),
B("{person} must remember ___ the door.",["to lock","locking","lock","locked"],0,"Remember to do means not forget a future action.","REMEMBER TO + VERB",("person",)),
B("Please ___ {person} about the meeting.",["remind","remember","recall","realise"],0,"Remind someone about something means make them remember it.","REMIND SOMEONE ABOUT",("person",)),
B("{person} didn't ___ the voice.",["recognise","recall to","remind","realise of"],0,"Recognise means identify something experienced before.","RECOGNISE A VOICE",("person",)),
B("{person} suddenly ___ the mistake.",["realised","recognised","reminded","recalled to"],0,"Realise means become aware of a fact.","REALISE A MISTAKE",("person",))],
"look_see_watch":[
B("{person} stopped to ___ at the view.",["look","see","watch","notice"],0,"Look at means direct your eyes deliberately.","LOOK AT",("person",)),
B("{person} could ___ a difference immediately.",["see","look","watch","observe at"],0,"See can mean perceive or notice a difference.","SEE A DIFFERENCE",("person",)),
B("{person} stayed home to ___ the match.",["watch","look","see at","notice"],0,"Watch is used for something viewed over time.","WATCH A MATCH",("person",)),
B("{person} didn't ___ the spelling mistake.",["notice","watch","look","observe at"],0,"Notice means become aware of something.","NOTICE A MISTAKE",("person",)),
B("Researchers ___ how people use {place}.",["observe","look","see to","watch at"],0,"Observe means watch carefully for study.","OBSERVE BEHAVIOUR",("place",))],
"general_confusables":[
B("{person} wants a more ___ car.",["economical","economic","economy","economics"],0,"Economical means inexpensive to use; economic relates to the economy.","ECONOMICAL = CHEAP TO RUN",("person",)),
B("This is a ___ matter for {person}.",["personal","personnel","personable","person"],0,"Personal means private or relating to one person.","PERSONAL = PRIVATE",("person",)),
B("{person} read the ___ report.",["latest","later","late","lastly"],0,"Latest means the most recent.","LATEST = MOST RECENT",("person",)),
B("{person} enjoys ___ music.",["classical","classic","classically","classicism"],0,"Classical describes the musical tradition; classic means outstanding or typical.","CLASSICAL MUSIC",("person",)),
B("Could you ___ {person} about the application?",["advise","advice","suggest to","recommend to"],0,"Advise is the verb used before a person; advice is a noun.","ADVISE = VERB",("person",))],
"connectors":[
B("{person} went out ___ it was raining.",["although","despite","because of","during"],0,"Although is followed by a full clause.","ALTHOUGH + CLAUSE",("person",)),
B("{person} arrived early ___ the delay.",["despite","although","because","while"],0,"Despite is followed by a noun phrase.","DESPITE + NOUN",("person",)),
B("{person} prefers trains, ___ Mia usually flies.",["whereas","despite","because of","unless"],0,"Whereas contrasts two clauses.","WHEREAS + CLAUSE",("person",)),
B("{person} won't go ___ the weather improves.",["unless","despite","during","because of"],0,"Unless means if not.","UNLESS = IF NOT",("person",)),
B("{person} left early ___ they could catch the train.",["so that","despite","unless","because of"],0,"So that introduces purpose followed by a clause.","SO THAT + CLAUSE",("person",))],
}
for _cat,_items in EXTRAS.items():
    SKILLS[_cat][1].extend(_items)

assert len(SKILLS)==25
REPURPOSED={"verb_ing","verb_to","bare_infinitive","phrasal_get_take","phrasal_put_set","phrasal_look_come"}
questions=[]
for si,(cat,(name,bases)) in enumerate(SKILLS.items()):
    assert len(bases)==10, (cat,len(bases))
    for bi,base in enumerate(bases):
        for vi in range(12):
            if bi<5:
                values={k:V[k][vi%len(V[k])] for k in base["keys"]}
            else:
                values={k:V[k][(vi*7+bi*11+si*13)%len(V[k])] for k in base["keys"]}
            q=base["q"].format(**values)
            fp=f"{cat}|{bi}|{vi}|"+re.sub(r"[^a-z0-9]+"," ",q.lower()).strip()
            if bi<5:
                if cat in REPURPOSED:
                    rep_i=["verb_ing","verb_to","bare_infinitive","phrasal_get_take","phrasal_put_set","phrasal_look_come"].index(cat)
                    qid=400001+rep_i*120+bi*24+vi
                else:
                    qid=200001+si*120+bi*24+vi
            else:
                qid=500001+si*60+(bi-5)*12+vi
            questions.append({"id":qid,"cat":cat,"skill":name,"templateId":f"{cat}-{bi}","domain":DOMAINS[(vi+bi)%len(DOMAINS)],"q":q,"a":base["a"],"c":base["c"],"rule":base["rule"],"trigger":base["trigger"],"targetTime":6.0 if si<17 else 6.4,"difficulty":"B2","fingerprint":fp,"focus":[]})
skills=[{"id":cat,"name":name} for cat,(name,_) in SKILLS.items()]
campaign={"schemaVersion":1,"campaignId":"B2-MCC-C1","title":"Adaptive B2 Multiple-Choice Cloze · Campaign 1","subtitle":"B2 First · Use of English intensive","version":"2026-09-26.4","startingLevel":1,"sessionSize":15,"timeLimit":15,"targetExercises":3000,"questions":questions,"skills":skills}
assert len(questions)==3000 and len({q["fingerprint"] for q in questions})==3000
(OUT/"campaign-01.json").write_text(json.dumps(campaign,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
print("questions",len(questions),"skills",len(skills),"bytes",(OUT/"campaign-01.json").stat().st_size)

def jsdump(x): return json.dumps(x,ensure_ascii=False,separators=(",",":"))
keys={}; lessons={}; coaches={}
for cat,(name,bases) in SKILLS.items():
    b=bases[0]; sample={k:V[k][0] for k in b["keys"]}; q=b["q"].format(**sample); ans=b["a"][b["c"]]; example=q.replace("___",ans)
    keys[cat]={"front":q,"back":example,"formula":b["trigger"],"cue":"Reconoce la combinación exacta antes de elegir."}
    lessons[cat]={"es":"Patrón de examen B2: "+b["rule"],"en":b["rule"],"formula":b["trigger"],"example":example,"translation":"","cue":"Lee la frase completa y elimina los distractores por combinación, régimen o significado."}
    coaches[cat]={"must":"Identifica primero qué combinación exige la frase. "+b["rule"],"secret":"SECRET KEY: "+b["trigger"],"trap":"No elijas por traducción aislada: compara la palabra con las que aparecen inmediatamente antes y después."}
(OUT/"keys.js").write_text("window.AE_KEYS="+jsdump(keys)+";\n",encoding="utf-8")
(OUT/"lessons.js").write_text("window.AE_LESSONS="+jsdump(lessons)+";\n",encoding="utf-8")
(OUT/"error-coach.js").write_text("window.AE_ERROR_COACH="+jsdump(coaches)+";\n",encoding="utf-8")
print("support",len(keys),len(lessons),len(coaches))
