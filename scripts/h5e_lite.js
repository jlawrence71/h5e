// Dependencies
//   - jquery-1.11.1-min.js
//   - audio-min.js, audiojs.swf, player-graphics.gif

var page = 1;
var path = "";
var completedPaths = {};
var audioPlayer;
var canProceed = false;
var playingAudio = false;
var playlist = [];
var currentPlaylistItem = 0;
var templateVarName = "template";
var showFailure = false;
var showCompletion = false;
var totalPaths = 0;

// Scoring
var maxWrong = 0;
var wrongAnswers = 0;
var totalQuestions = 0;
var points = 0;
var minimumPassingPoints = 0;

// *** Polyfill for IE8 not having Object.keys function ***

if (!Object.keys) Object.keys = function(o) {
  if (o !== Object(o))
    throw new TypeError('Object.keys called on a non-object');
  var k=[],p;
  for (p in o) if (Object.prototype.hasOwnProperty.call(o,p)) k.push(p);
  return k;
}

// *** Course lifecycle ***

function initializeCourse(){
	APILocatorLoop();
	SCOInitialize();

	restoreCompletedPaths();
	
}

function finalizeCourse(){
	
	var score = 0;
	
	if(totalQuestions > 0)
		score = Math.round( (points/totalQuestions) * 100);
	
	SCOSetValue("cmi.core.score.raw",score);
	
	if(points < minimumPassingPoints )
		SCOSetValue("cmi.core.lesson_status","failed");
	else
		SCOSetValue("cmi.core.lesson_status","passed");
	
	SCOCommit();
	//SCOFinish();
}

// *** Audio ***

function initAudio(){
	
	var audioDiv = $("#audioDiv");
	var audioSrc = playlist[currentPlaylistItem];
	audioDiv.html("<audio id='audioPlayer' src='"+audioSrc+"' preload='auto'/>");
	
	audioPlayer = audiojs.createAll()[0];
	audioPlayer.trackEnded = audioFinished;
}

function playAudio() {
	if( playingAudio === false){
		audioPlayer.play();
		playingAudio = true;
	} else {
		audioPlayer.pause();
		playingAudio = false;
	}
}

function audioFinished(){
	playingAudio = false;
	
	// Check to see if there are more items to play
	if(playlist.length > currentPlaylistItem +1){
		currentPlaylistItem++;
		audioPlayer.load(playlist[currentPlaylistItem]);
		playAudio();
	} else {	
		canProceed = true;
		// Reset in case they want to play sequence again
		currentPlaylistItem=0;
		audioPlayer.load(playlist[currentPlaylistItem]);
	}
}

// *** Navigation ***

function prevPageDebug(){
	canProceed = true;
	previousPage();
}

function nextPageDebug(){
	canProceed = true;
	nextPage();
}

function selectAnswerDebug(page){
	canProceed = true;
	selectAnswer(page);
}

function gotoPageDebug(page){
	canProceed = true;
	gotoPage(page);
}

function previousPage(){
	if(canProceed === false)
		return;

	if(page>1){
		page--;
		showPage("page"+path+page);
	} else {
		showPage("menu");
	}
}  

function nextPage(){
	if(canProceed === false)
		return;
		
	page++;
	showPage("page"+path+page);
}

function gotoMenu(){
	if(canProceed === false)
		return;

	showPage("menu");
}

function gotoPage(pageNbr){
	if(canProceed === false)
		return;
		
	// Reset points just in case they are starting over
	if(pageNbr === 1)
		points = 0;
	
	page = pageNbr;
	showPage("page"+path+page);
}

function selectAnswer(pageNbr,answerPoints){
	if(canProceed === false)
		return;

	points += answerPoints;

	page=pageNbr;
	showPage("page"+path+page);
}

function selectPath(pathLetter){
	page = 1;
	path = pathLetter;
	showPage("page"+path+page);
	
	// Load metadata
	var metadata = window["metadata"+pathLetter];
	maxWrong             = metadata.max_wrong;
	totalQuestions       = metadata.total_questions;
	totalPaths           = metadata.total_paths;
	minimumPassingPoints = metadata.minumum_passing_points;
}

// *** UI ***

function showPage(dataName){
	// By default, disable next until audio is finished
	canProceed = false;
	
	// Stop any Audio on show of a page
	$("#audioDiv").html("");
	playingAudio = false;
	
	// Show the page number
	$("#page").html(dataName);
	
	if(showCompletion === true){
		showCompletion = false;
		dataName = "finished";
	}
				
	if(showFailure === true){
		dataName = "conclusion_fail";
		showFailure = false;
	}
				
	var page_data;
	try{
		page_data = window[dataName];
		var myIch = ich[page_data[templateVarName]];
		var theHtml = myIch(page_data);
		$("#content").html(theHtml);	
	
	} catch(err) {
		console.log("ERROR " + err);
		$("#page").html("Problem ! - '"+dataName+"'");
		return;
	}
	
	// Show failure attempts as 'message' in our templates
	if(wrongAnswers > 0)
		$("#message").html("Attempt #"+(wrongAnswers+1));
	
	// Page can indicate my 'pathCompleted', that the Path should get a checkmark
	// Whenever the menu is displayed again.
	if(page_data.pathCompleted !== undefined){
		completedPaths[page_data.pathCompleted] = true;
		setPathCompleted(page_data.pathCompleted);
	}
	
	// Let the page override the canProceed flag (which is false by default)
	// Completion of the audio file will trigger a change in canProceed, letting the user move on.
	if(page_data.canProceed !== undefined)
		canProceed = page_data.canProceed;
	
	// Initialize audio should 'audio_src' be present
	if(page_data.audio_src !== undefined){
		currentPlaylistItem = 0;
		playlist = page_data.audio_src;
		initAudio();
	}
	
	// Increment wrong answer count should they choose un-wisely
	if(page_data.wrong_answer === true){
		wrongAnswers++;
	
		if(wrongAnswers === maxWrong){
			showFailure = true;			
			finalizeCourse();
		}
	}
	
	// In the main menu, apply checkmarks for completed Paths 
	if(dataName === "menu")
		applyCompletedClassForMenu();
}

// Applying and restoring completed paths state in course

function applyCompletedClassForMenu(){
	for(var key in completedPaths){
		$("#btn"+key).addClass("completed");
	}
}

function getCompletedPathCount(){
	var keys = Object.keys(completedPaths);
	
	if(keys === undefined)
		return 0;
	
	return keys.length;
}

function setPathCompleted(path){
	
	if(path === null)
		return;
		
	var savedCompletedPaths = SCOGetValue("cmi.core.lesson_location");
	
	//Do not duplicate an already completed path
	if(savedCompletedPaths !== null && savedCompletedPaths.indexOf(path) !== -1)
		return;
	
	if(  savedCompletedPaths === null || savedCompletedPaths === "")
		savedCompletedPaths = path;
	else
		savedCompletedPaths += "," + path;
			
	SCOSetValue("cmi.core.lesson_location",savedCompletedPaths);
	SCOCommit();
	
	// Check for completed course
	if(isCourseCompleted() === true){
		showCompletion = true;
		finalizeCourse();
	}
}

function restoreCompletedPaths(){
	var savedCompletedPaths = SCOGetValue("cmi.core.lesson_location");
	
	if(savedCompletedPaths !== null && savedCompletedPaths !== ""){
		var pathsArray = savedCompletedPaths.split(',');
	
		for(var i=0;i<pathsArray.length;i++)
			completedPaths[pathsArray[i]] = true;
	}
}

function isCourseCompleted(){
	var count = 0;
	for(var key in completedPaths)
		count++;
	if( count >= totalPaths)
		return true;
	return false;
}
