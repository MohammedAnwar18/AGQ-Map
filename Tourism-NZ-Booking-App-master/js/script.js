// ==========================================================
  // NAVIGATION
// ==========================================================
$(document).ready(function(){
  $("#homepage").show();
  $("#accommodation-options, #accommodation-details, #booking-confirmation").hide();
  $("#search-btn").click(function(){
    $('#homepage, #accommodation-details, #booking-confirmation, #footer').hide();
    $('#accommodation-options').show();
  });
  $("#book-btn").click(function(){
    $('#homepage, #accommodation-options, #accommodation-details, #noResult').hide();
    $('#booking-confirmation, #footer').show();
  });
  $("#back-btn__1").click(function(){
    $('#accommodation-details, #accommodation-options, #booking-confirmation, #noResult').hide();
    $('#homepage').show();
    $('#cardResult').empty();
  });
  $("#back-btn__noResult").click(function(){
    $('#homepage, #accommodation-details, #noResult, #booking-confirmation').hide();
    $('#homepage, #footer').show();
  });
  $("#back-btn__2").click(function(){
    $('#homepage, #accommodation-details, #booking-confirmation').hide();
    $('#accommodation-options').show();
  });
  $("#other-booking").click(function(){
    $('#cardResult').text('');
    $('#accommodation-details, #accommodation-options, #booking-confirmation').hide();
    $('#homepage').show();
  });
  $('body').append(script);
}); //document ready

var selectedId;

// ==========================================================
// GOOGLE MAP
// ==========================================================
function initMap(){
    const map = new google.maps.Map(document.getElementById("map"), {
      zoom: 10,
      center: { lat: -45.031200, lng: 168.660690 },
      mapTypeId : 'roadmap'
    });//map

    // ==========================================================
    // DATEPICKERS
    // ==========================================================
    var todayDate =new Date();
    var dd = String(todayDate.getDate()).padStart(2, '0');
    var mm = String(todayDate.getMonth() + 1).padStart(2, '0');
    var yyyy = todayDate.getFullYear();
    todayDate = dd + '-' + mm + '-' + yyyy;

    // OPTIONAL PLACEHOLDERS:
    // $('#checkIn').val(todayDate);
    // $('#checkOut').val(todayDate);
    var stDate;
    var enDate;

    $('#checkIn').datepicker({
       dateFormat : 'dd-mm-yy',
       changeMonth : true,
       minDate :new Date(),
       maxDate : '+1y',
       onSelect : function(date){
         stDate = $(this).datepicker('getDate');
       },
       onClose: function (selectedDate, instance) {
        if (selectedDate != '') {
          var minDate2 = new Date(selectedDate);
          minDate2.setDate(minDate2.getDate() + 1);
            $("#checkOut").datepicker("option", "minDate", minDate2);
            var date = $.datepicker.parseDate(instance.settings.dateFormat, selectedDate, instance.settings);
            date.setDate(date.getDate() + 15);
            $("#checkOut").datepicker("option", "minDate", selectedDate);
            $("#checkOut").datepicker("option", "maxDate", date);
          }
        }
      });

     $('#checkOut').datepicker({
       dateFormat : 'dd-mm-yy',
       changeMonth : true,
       minDate :new Date(),
       maxDate : '+15d',
       onSelect : function(){
       enDate = $(this).datepicker('getDate');
      }
     });

     // ==========================================================
     // SEARCH BUTTON CLICK EVENT
     // ==========================================================
    document.getElementById('search-btn').addEventListener('click', function(){

    var days = Math.ceil((enDate - stDate) / (1000 * 60 * 60 * 24)) ;

    // CALCULATE GUESTS
     var guestAmount = document.getElementById('guests').value;
     guestAmount = parseInt(guestAmount);

     // PUSH BOOKING SUMMARY
     document.getElementById('checkInResult').innerHTML = checkIn.value;
     document.getElementById('checkOutResult').innerHTML = checkOut.value;
     document.getElementById('guestsResult').innerHTML = guestAmount + ' ' + 'Guests';
     document.getElementById('daysResult').innerHTML = days + ' ' + 'Nights';

     // CARD LOOP
     for (var i = 0 ; i < accommodation.length ; i++) {
        if ((isNaN(days)) || (days === 0) || (Math.sign(days) === -1)) {
          $('#accommodation-options, #accommodation-details, #booking-confirmation, #footer').hide();
          $('#homepage, #footer').show();
          document.getElementById('noResult').innerHTML = 'Please input a valid date.';
       }
         if (((days <= accommodation[i].maxDays) && (days >= accommodation[i].minDays)) && ((guestAmount <= accommodation[i].maxGuests) && (guestAmount >= accommodation[i].minGuests))) {
           displayCards(i);
           calculateSubtotal(i, guestAmount, days);
       }
     }

     // Calcualte Subtotal
     function calculateSubtotal(k, guest, days) {
       var i;
       for (i = 0 ; i < accommodation.length ; i++) {
         if (k === i) {
         var subtotal = accommodation[i].price * guest * days;
         var gst = subtotal * 0.15;
         var total = subtotal + gst;

        // PUSH PRICE TO DOM
         document.getElementById('subtotalResult').innerHTML = '$' + subtotal;
         document.getElementById('gstResult').innerHTML = '$' + gst;
         document.getElementById('totalResult').innerHTML = '$' + total;
        }
       }
     }
    }); //search button


    // ==========================================================
    // Display cards
    // ==========================================================
    function displayCards(j){
      $('#cardResult').append( '<div class="p-3 col-12 col-sm-12 col-md-12 col-lg-6 col-xl-6">' +
    '              <div class="card border-0 rounded float-left w-100 h-100">' +
    '                <div class="card-body rounded w-100 text-white p-0 bgImg" id="' + accommodation[j].bgImg + '">' +
    '                 <div class="h-50 clearfix d-block w-100">' +
    '                  <div class="card-textbox w-100 p-2 rounded-bottom clearfix">' +
    '                    <h5 class="card-title">' + accommodation[j].name + '</h5>' +
    '                    <p class="card-text">' + accommodation[j].address + '</p>' +
    '                    <div class="details-btn__container float-left" id="' + accommodation[j].id + '">' +
    '                      <p class="btn btn-primary text-white rounded text-center details-btn bg-primary">Details</p>' +
    '                    </div>' +
    '                    <div class="price-textbox float-right">' +
    '                      <p class="pt-1">$' + accommodation[j].price + '/night</p>' +
    '                    </div>' +
    '                   </div>' +
    '                  </div>' +
    '                </div>' +
    '              </div>' +
    '            </div>'
                      ); //append ends here
        displayDetails(accommodation[j].id);
      } //displayCards

      // ==========================================================
      // Display Details
      // ==========================================================
      function displayDetails(id) {
        $('.details-btn__container').click(function(){
            selectedId = this.id;
            var i;
            for (i = 0 ; i < accommodation.length ; i++) {
              if (parseInt(this.id) === accommodation[i].id) {
                $('#homepage, #accommodation-options, #booking-confirmation').hide();
                $('#accommodation-details').show();
                $('#footer').hide();

                callDescription(i);
                callCarousel(i);

                // MARKER
                var position = { lat: accommodation[i].latitude, lng: accommodation[i].longitude };

                var marker = new google.maps.Marker({
                  position: position,
                  map: map
                });
              }
            }
            //CLEAR CURRENT MARKER
            $("#book-btn").click(function(){
              marker.setMap(null);
            });
            $("#back-btn__2").click(function(){
              marker.setMap(null);
            });
          });
        } //display details

        // MEAL PRICES
        var breakfast = 20;
        var lunch = 25;
        var dinner = 35;

        // ==========================================================
        // MEAL CALCULATOR
        // ==========================================================

          // Breakfast Checkbox
          $('#inlineCheckbox1[type="checkbox"]').change(function(){
          if($(this).prop("checked")){
              var subtotal = $('#subtotalResult').text();
              var mealTotal = addMeal(subtotal, breakfast);
              var gst = mealTotal * 0.15;
              var total = mealTotal + gst;
              pushMealResult(mealTotal, gst, total);
          }
          else if (!$(this).prop("checked")){
              subtotal = $('#subtotalResult').text();
              mealTotal = minusMeal(subtotal, breakfast);
              gst = mealTotal * 0.15;
              total = mealTotal + gst;
              pushMealResult(mealTotal, gst, total);
          }
          $('#inlineCheckbox1[type="checkbox"]').on('change', function() {
            $('#inlineCheckbox4[type="checkbox"]').not(this).prop('checked', false);
          });
        });

        // Lunch Checkbox
        $('#inlineCheckbox2[type="checkbox"]').change(function(){
        if($(this).prop("checked")){
            var subtotal = $('#subtotalResult').text();
            var mealTotal = addMeal(subtotal, lunch);
            var gst = mealTotal * 0.15;
            var total = mealTotal + gst;
            pushMealResult(mealTotal, gst, total);
        }
        else if(!$(this).prop("checked")){
            subtotal = $('#subtotalResult').text();
            var mealTotal = minusMeal(subtotal, lunch);
            gst = mealTotal * 0.15;
            total = mealTotal + gst;
            pushMealResult(mealTotal, gst, total);
        }
        $('#inlineCheckbox2[type="checkbox"]').on('change', function() {
          $('#inlineCheckbox4[type="checkbox"]').not(this).prop('checked', false);
        });
      });

      // Dinner Checkbox
      $('#inlineCheckbox3[type="checkbox"]').change(function(){
      if($(this).prop("checked")){
          var subtotal = $('#subtotalResult').text();
          var mealTotal = addMeal(subtotal, dinner);
          var gst = mealTotal * 0.15;
          var total = mealTotal + gst;
          pushMealResult(mealTotal, gst, total);
      }
      else if(!$(this).prop("checked")){
          subtotal = $('#subtotalResult').text();
          var mealTotal = minusMeal(subtotal, dinner);
          gst = mealTotal * 0.15;
          total = mealTotal + gst;
          pushMealResult(mealTotal, gst, total);
      }
      $('#inlineCheckbox3[type="checkbox"]').on('change', function() {
        $('#inlineCheckbox4[type="checkbox"]').not(this).prop('checked', false);
      });
    });

      // None Checkbox
      $('#inlineCheckbox4[type="checkbox"]').change(function(){
      if ($('#inlineCheckbox1').prop("checked")){
          var subtotal = $('#subtotalResult').text();
          var mealTotal = minusMeal(subtotal, breakfast);
          var gst = mealTotal * 0.15;
          var total = mealTotal + gst;
          pushMealResult(mealTotal, gst, total);
      }
      if ($('#inlineCheckbox2').prop("checked")){
          subtotal = $('#subtotalResult').text();
          var mealTotal = minusMeal(subtotal, lunch);
          gst = mealTotal * 0.15;
          total = mealTotal + gst;
          pushMealResult(mealTotal, gst, total);
      }
      if ($('#inlineCheckbox3').prop("checked")){
          subtotal = $('#subtotalResult').text();
          var mealTotal = minusMeal(subtotal, dinner);
          gst = mealTotal * 0.15;
          total = mealTotal + gst;
          pushMealResult(mealTotal, gst, total);
        }
      });

      // CLEAR CHECKBOXES ON WHEN NONE IS SELECTED
      $('#inlineCheckbox4[type="checkbox"]').on('change', function() {
        $('#inlineCheckbox1[type="checkbox"]').not(this).prop('checked', false);
        $('#inlineCheckbox2[type="checkbox"]').not(this).prop('checked', false);
        $('#inlineCheckbox3[type="checkbox"]').not(this).prop('checked', false);
      });

      // Add Meal Price Function
      function addMeal(subtotal, meal) {
        subtotal = subtotal.replace(/\$/g,'');
        subtotal = parseInt(subtotal);
        var mealTotal = subtotal + meal;
        return mealTotal;
      }

      // Minus Meal Price Function
      function minusMeal(subtotal, meal) {
        subtotal = subtotal.replace(/\$/g,'');
        subtotal = parseInt(subtotal);
        var mealTotal = subtotal - meal;
        return mealTotal;
      }

      // PUSH UPDATED MEAL PRICE TO DOM
      function pushMealResult(subtotal, gst, total) {
         document.getElementById('subtotalResult').innerHTML = '$' + subtotal;
         document.getElementById('gstResult').innerHTML = '$' + gst;
         document.getElementById('totalResult').innerHTML = '$' + total;
      }

      // Call Description
      function callDescription(j){
        $('#descriptionResult').text('');
        $('#descriptionResult').append(
        '                <div class="p-4 rounded-top mb-4">' +
        '                  <h2 class="font-weight-bold mb-4">' + accommodation[j].name + '</h2>' +
        '                  <hr class="bg-white w-75 mx-0 mb-3">' +
        '                  <p class="pt-2">' + accommodation[j].description + '</p>' +
        '                </div>');
      }

      // Call Carousel
      function callCarousel(j){
        $('#carouselResult').text('');
        $('#carouselResult').append(
          '                  <div id="carouselExampleControls" class="carousel slide myCarousel" data-ride="carousel">' +
          '                    <div class="carousel-inner inner h-100">' +
          '                      <div class="carousel-item active h-100">' +
          '                        <img class="d-block img-fluid w-100 h-100" src="images/accommodation/' + accommodation[j].image + '" alt="First slide">' +
          '                      </div>' +
          '                      <div class="carousel-item h-100">' +
          '                        <img class="d-block img-fluid w-100 h-100" src="images/accommodation/' + accommodation[j].carousel1 + '" alt="Second slide">' +
          '                      </div>' +
          '                      <div class="carousel-item h-100">' +
          '                        <img class="d-block img-fluid w-100 h-100" src="images/accommodation/' + accommodation[j].carousel2 + '" alt="Third slide">' +
          '                      </div>' +
          '                      <div class="carousel-item h-100">' +
          '                        <img class="d-block img-fluid w-100 h-100" src="images/accommodation/' + accommodation[j].carousel3 + '" alt="Fourth slide">' +
          '                      </div>' +
          '                    </div>' +
          '                    <a class="carousel-control-prev" href="#carouselExampleControls" role="button" data-slide="prev">' +
          '                      <span class="carousel-control-prev-icon" aria-hidden="true"></span>' +
          '                      <span class="sr-only">Previous</span>' +
          '                    </a>' +
          '                    <a class="carousel-control-next" href="#carouselExampleControls" role="button" data-slide="next">' +
          '                      <span class="carousel-control-next-icon" aria-hidden="true"></span>' +
          '                      <span class="sr-only">Next</span>' +
          '                    </a>' +
          '                  </div>');
      }

    // REFERENCE NUMBER GENERATOR
    document.getElementById("randomNumberResult").innerHTML = 'Your reservation code is #' +
    Math.floor(Math.random() * 1000000000) + 1;

    // EMAIL CONFIRMATION
    document.getElementById('send-btn').addEventListener('click', function(){
      var email = document.getElementById('emailInput').value;
      ValidateEmail(email);
      function ValidateEmail(inputText) {
      var mailformat = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
      if(emailInput.value.match(mailformat)) {
      document.getElementById('emailConfirmation').innerHTML = 'Itinerary sent!';
      }
      else {
      document.getElementById('emailConfirmation').innerHTML = "<p class='text-danger'>Please input a valid email address</p>";
      }
    }
  });
 } // end of map

// ==========================================================
// MAPKEY
// ==========================================================
var script = '<script src="https://maps.googleapis.com/maps/api/js?key=' + key + '&callback=initMap&libraries=&v=weekly" defer></script>';

// ==========================================================
  // ARRAY OF OBJECTS DECLARATION
// ==========================================================
var accommodation = [
  {
    id : 101,
    name : 'Adventure Queenstown Hostel',
    description : 'Welcome to Adventure Queenstown Hostel.' + '<br>' +
                  '<br>' +
                  'Catering to independent travellers from around the world we offer mostly shared room accommodation and run in-house activities 5 nights a week to make it easy to meet fellow explorers from all around the world.' + '<br>' +
                  '<br>' +
                  'There is a tour desk where our friendly staff can help you plan your activities, as well as a separate storage/locker room with secure bicycle parking and ski & snowboard storage. We offer loads of free stuff and even a simple laundry service.' + '<br>' +
                  '<br>' +
                  'We’re a smaller hostel with a maximum capacity of just 43 people - the perfect number for keeping a family atmosphere which is still fun and vibrant.' + '<br>' +
                  '<br>' +
                  'Being the most central accommodation in town, you’re just a minutes walk to everything. At night you can sleep soundly as there are no bars directly by us.',
    address : '36 Camp Street, Queenstown',
    price : 30,
    bgImg : 'bgImg1',
    image : 'hostel-1.jpg',
    carousel1 : 'hostel-carousel-1.jpg',
    carousel2 : 'hostel-carousel-2.jpg',
    carousel3 : 'hostel-carousel-3.jpg',
    latitude : -45.031200,
    longitude : 168.660690,
    minGuests : 1,
    maxGuests : 1,
    minDays : 1,
    maxDays : 10
  },
  {
    id : 102,
    name : 'Queenstown Motel Apartments',
    description : 'Welcome to  Queenstown Motel Apartments.' + '<br>' +
                  'Conveniently located at 7-8 minutes walk from town centre, Queenstown Motel Apartments offer comfortable rooms with free guest wifi and free on-site parking. We are a self-rated 4-Star property. Our modern rooms include en-suite and kitchenette (fridge, microwave, tea/coffee making facilities, toaster, kettle and cutlery).' + '<br>' +
                  'Only a one minute walk to both the Millennium Hotel and the Copthorne Lakeview, we are a popular alternative for conference attendees. Skyline Gondola is 15 minute walk. Queenstown Airport is 10 minute drive and Remarkables Ski is approx. 35 minute drive.' + '<br>' +
                  'Weather you are travelling for work or recreation, Queenstown Motel Apartments offer a comfortable stay in the perfect spot. We look forward to hosting you.',
    address : '62 Frankton Road, Queenstown',
    price : 90,
    bgImg : 'bgImg2',
    image : 'motel-2-4.jpg',
    carousel1 : 'motel-carousel-1.jpg',
    carousel2 : 'motel-carousel-2.jpg',
    carousel3 : 'motel-carousel-3.jpg',
    latitude : -45.033850,
    longitude : 168.669430,
    minGuests : 2,
    maxGuests : 4,
    minDays : 3,
    maxDays : 10
  },
  {
    id : 103,
    name : 'The Rees Hotel',
    description : 'The Rees offers a variety of spacious and luxurious accommodation options including 60 Hotel rooms, 90 Apartments and five private, 3-bedroom, 3-bathroom Lakeside Residences, all with terraces, showcasing spectacular views across Lake Wakatipu to the alpine panorama of the Remarkable Mountain range.' + '<br>' + '<br>' +
                  'The many exceptional features at The Rees Hotel include a library of rare books and art, courtesy shuttle to/from Queenstown town centre, complimentary high-speed Wi-Fi, movies and local telephone calls, conference rooms, a fully-equipped gymnasium, secure undercover parking, electric car-charging station and its own private beach and wharf accessing jet-boat and water taxi services.' + '<br>' + '<br>' +
                  'Our team of experienced local and international staff pride themselves on delivering professional friendly service that consistently exceeds our guests’ expectations and is a hallmark of The Rees Hotel’s reputation.',
    address : '377 Frankton Road, Queenstown',
    price : 157,
    bgImg : 'bgImg3',
    image : 'hotel-1-2.jpg',
    carousel1 : 'hotel-carousel-1.jpg',
    carousel2 : 'hotel-carousel-2.jpg',
    carousel3 : 'hotel-carousel-3.jpg',
    latitude : -45.028390,
    longitude : 168.687880,
    minGuests : 1,
    maxGuests : 2,
    minDays : 1,
    maxDays : 5
  },
  {
    id : 104,
    name : 'Queenstown House Homestay',
    description : "A newly built single-family home within South Island's finest golf course, Jackpoint Complex, a neighborhood used for local residential use rather than tourist use." + '<br>' + '<br>' +
                  'Jackpoint Clubhouse and golf course are a five-minute walk away, followed by dinner and golf practice.' + '<br>' + '<br>' +
                  'Approximately 10 minutes by car from the airport, 18 minutes from Queenstown, 30 minutes from Aerotown, 25 minutes from Milbrook Resort, 25 minutes from Remarkable Ski Area, 35 minutes from Coronet Pic Ski Area and Remarkable Shopping Center',
    address : '25 Kawarau Place, Queenstown',
    price : 240,
    bgImg : 'bgImg4',
    image : 'house-1-4.jpg',
    carousel1 : 'house-carousel-1.jpg',
    carousel2 : 'house-carousel-2.jpg',
    carousel3 : 'house-carousel-3.jpg',
    latitude : -45.029890,
    longitude : 168.740710,
    minGuests : 1,
    maxGuests : 4,
    minDays : 2,
    maxDays : 15
  }
];
