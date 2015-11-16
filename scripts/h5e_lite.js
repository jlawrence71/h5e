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
var sub_playlist = [];
var currentPlaylistItem = 0;
var templateVarName = "template";
var showFailure = false;
var totalPaths = 0;
var interactCount = 0;
var interactCountMin = 0;
var page_data;

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

function initAudio(playlistName,autoplay){
	currentPlaylistItem = 0;
	playlist = page_data[playlistName];

	var audioDiv = $("#audioDiv");
	var audioSrc = playlist[currentPlaylistItem];
	audioDiv.html("<audio id='audioPlayer' src='"+audioSrc+"' preload='auto'/>");
	
	audioPlayer = audiojs.createAll()[0];
	audioPlayer.trackEnded = audioFinished;

	if(autoplay === true)
		playAudio();	
}

function playPlaylist(playlistName){
	initAudio(playlistName,true);
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

function resetPageAudio(){
	// If page has a playlist, always set it back to that one for page level replay
	if(page_data.audio_src !== undefined)
		playlist = page_data["audio_src"];

	// Reset in case they want to play sequence again
	currentPlaylistItem=0;
	audioPlayer.load(playlist[currentPlaylistItem]);
}

function audioFinished(){
	playingAudio = false;
	
	// Check to see if there are more items to play
	if(playlist.length > currentPlaylistItem +1){
		currentPlaylistItem++;
		audioPlayer.load(playlist[currentPlaylistItem]);
		playAudio();
	} else {
		if(interactCount >= interactCountMin){
			canProceed = true;
			enableNext();
		}	
		resetPageAudio();
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
	minimumPassingPoints = metadata.minimum_passing_points;
}

// *** Interaction *** 

function onPageInteraction(itemNbr,playlistName){
	// If audio is playing, do nothing until it finishes
	if(playingAudio === true)
		return;

	// Do not double count
	if($("#interact_"+itemNbr).hasClass("btn_interact_completed") === false)
		interactCount++;

	$(".more").addClass("hidden");
	$("#more_"+itemNbr).removeClass("hidden");
	$("#interact_"+itemNbr).addClass("btn_interact_completed");
	
	if(playlistName !== undefined)
		initAudio(playlistName,true);
	
	if(interactCount >= interactCountMin){
		canProceed = true;
		enableNext();
	}	
}

function onSelectAnswer(id,playlistName,correct){
	interactCount++;	

	if(correct == true)
		$("#answer_"+id).addClass("btn_answer_correct");
	else
		$("#answer_"+id).addClass("btn_answer_incorrect");

	if(playlistName !== undefined)
		initAudio(playlistName,true);

	if(interactCount >= interactCountMin){
		canProceed = true;
		//enableNext();
	}
}

// *** UI ***

function enableNext(){
	$(".btn_nav").addClass("btn_nav_enabled");
}

function disableNext(){
	$(".btn_nav").removeClass("btn_nav_enabled");
}

function showPage(dataName){
	// By default, disable next until audio is finished
	canProceed = false;
	proceedCount = 0;
	interactCountMin = 0;
	interactCount = 0;
	
	// Reset next button
	disableNext();

	// Stop any Audio on show of a page
	$("#audioDiv").html("");
	playingAudio = false;
	
	// Show the page number
	$("#page").html(dataName);
			
	if(showFailure === true){
		dataName = "conclusion_fail";
		showFailure = false;
	}
				
	try{
		page_data = window[dataName];
		var myIch = ich[page_data[templateVarName]];
		var theHtml = myIch(page_data);
		$("#content").html(theHtml);	
	
	} catch(err) {
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
	
	// Page can indicate how many interactionas are required before proceeding.
	if(page_data.interactCountMin !== undefined)
		interactCountMin = page_data.interactCountMin;

	// Initialize audio should 'audio_src' be present
	if(page_data.audio_src !== undefined){
		if(page_data.autoplay !== undefined){
			if(page_data.autoplay === true)		
				initAudio("audio_src",true);
			else
				initAudio("audio_src",false);
		}
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
	if(isCourseCompleted() === true)
		finalizeCourse();
		
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
