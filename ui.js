$(async function () {
  // cache some selectors we'll be using quite a bit
  const $allStoriesList = $("#all-articles-list");
  const $submitForm = $("#submit-form");
  const $filteredArticles = $("#filtered-articles");
  const $loginForm = $("#login-form");
  const $createAccountForm = $("#create-account-form");
  const $ownStories = $("#my-articles");
  const $navLogin = $("#nav-login");
  const $navLogOut = $("#nav-logout");
  const $navSubmit = $("#nav-submit");
  const $navFav = $("#nav-favorites");
  const $navStories = $("#nav-stories");
  const $userNav = $(".user-nav-links");
  const $favStories = $("#favorited-articles");

  // global storyList variable
  let storyList = null;

  // global currentUser variable
  let currentUser = null;

  await checkIfLoggedIn();

  /**
   * Event listener for logging in.
   *  If successfully we will setup the user instance
   */

  $loginForm.on("submit", async function (evt) {
    evt.preventDefault(); // no page-refresh on submit

    // grab the username and password
    const username = $("#login-username").val();
    const password = $("#login-password").val();

    // call the login static method to build a user instance
    const userInstance = await User.login(username, password);
    // set the global user to the user instance
    currentUser = userInstance;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  /**
   * Event listener for signing up.
   *  If successfully we will setup a new user instance
   */

  $createAccountForm.on("submit", async function (evt) {
    evt.preventDefault(); // no page refresh

    // grab the required fields
    let name = $("#create-account-name").val();
    let username = $("#create-account-username").val();
    let password = $("#create-account-password").val();

    // call the create method, which calls the API and then builds a new user instance
    const newUser = await User.create(username, password, name);
    currentUser = newUser;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });
  //  call the add story method and create object to be passed through, using the dom
  $submitForm.on("submit", async function (e) {
    e.preventDefault();
    let storyObj = {
      token: currentUser.loginToken,
      story: {
        author: $("#author").val(),
        title: $("#title").val(),
        url: $("#url").val(),
      },
    };
    await new StoryList().addStory(currentUser, storyObj);

    // update the current list of stories with new story.
    await generateStories();
    $submitForm.trigger("reset");
    $submitForm.slideToggle();
  });

  // selecting favorites event handler
  $(".articles-container").on("click", ".star", async function (evt) {
    if (currentUser) {
      const $target = $(evt.target);
      const $storyLi = $target.closest("li");
      const storyId = $storyLi.attr("id");

      // check if item is already favorited
      if ($target.hasClass("fas")) {
        // remove from favorites
        await currentUser.removeFavorite(storyId);
        // make favorite star empty
        $target.closest("i").toggleClass("fas far");
      } else {
        // the item is not currently favorited
        await currentUser.addFavorite(storyId);
        $target.closest("i").toggleClass("fas far");
      }
    }
  });

  /**
   * Log Out Functionality
   */

  $navLogOut.on("click", function () {
    // empty out local storage
    localStorage.clear();
    // refresh the page, clearing memory
    location.reload();
  });

  /**
   * Event Handler for Clicking Login
   */

  $navLogin.on("click", function () {
    // Show the Login and Create Account Forms
    $loginForm.slideToggle();
    $createAccountForm.slideToggle();

    $allStoriesList.toggle();
  });
  // Event handler for clicking submit
  $navSubmit.on("click", function () {
    // show the submit/create new story form
    $submitForm.slideToggle();
  });

  // Event Handeler for clicking navbar favorites.
  $("body").on("click", "#nav-favorites", function () {
    hideElements();
    $allStoriesList.hide();
    $("#favorited-articles").show();
    createFaves();
  });
  // Event Handeler for clicking navbar my stories.
  $("body").on("click", "#nav-stories", function () {
    hideElements();
    $allStoriesList.hide();
    $("#my-articles").show();
    createOwnStories();
  });
  /**
   * Event handler for Navigation to Homepage
   */

  $("body").on("click", "#nav-all", async function () {
    hideElements();
    await generateStories();
    $allStoriesList.show();
  });

  $ownStories.on("click", ".trash-can", async function (evt) {
    // retrieve the ID for the story
    const $closestLi = $(evt.target).closest("li");
    const storyId = $closestLi.attr("id");

    // remove the story from the user
    await storyList.removeStory(currentUser, storyId);

    await generateStories();

    hideElements();

    // show story list again
    $allStoriesList.show();
  });

  /**
   * On page load, checks local storage to see if the user is already logged in.
   * Renders page information accordingly.
   */

  async function checkIfLoggedIn() {
    // let's see if we're logged in
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    // if there is a token in localStorage, call User.getLoggedInUser
    //  to get an instance of User with the right details
    //  this is designed to run once, on page load
    currentUser = await User.getLoggedInUser(token, username);
    await generateStories();

    if (currentUser) {
      showNavForLoggedInUser();
    }
  }

  /**
   * A rendering function to run to reset the forms and hide the login info
   */

  function loginAndSubmitForm() {
    // hide the forms for logging in and signing up
    $loginForm.hide();
    $createAccountForm.hide();

    // reset those forms
    $loginForm.trigger("reset");
    $createAccountForm.trigger("reset");

    // show the stories
    $allStoriesList.show();

    // update the navigation bar
    showNavForLoggedInUser();
  }

  /**
   * A rendering function to call the StoryList.getStories static method,
   *  which will generate a storyListInstance. Then render it.
   */

  async function generateStories() {
    // get an instance of StoryList
    const storyListInstance = await StoryList.getStories();
    // update our global variable
    storyList = storyListInstance;
    // empty out that part of the page
    $allStoriesList.empty();

    // loop through all of our stories and generate HTML for them
    for (let story of storyList.stories) {
      const result = generateStoryHTML(story);
      $allStoriesList.append(result);
    }
  }

  /**
   * A function to render HTML for an individual Story instance
   */

  function generateStoryHTML(story, usersStory) {
    let hostName = getHostName(story.url);
    let star = isFavorite(story) ? "fas" : "far";
    // add trash can icon if it's current users story
    const trashCan = usersStory
      ? `<span class="trash-can">
          <i class="fas fa-trash-alt"></i>
        </span>`
      : "";
    // render story markup
    const storyMarkup = $(`
      <li id="${story.storyId}">
      ${trashCan}
      <span class="star">
          <i class="${star} fa-star"></i>
        </span>
        <a class="article-link" href="${story.url}" target="a_blank">
          <strong>${story.title}</strong>
        </a>
        <small class="article-author">by ${story.author}</small>
        <small class="article-hostname ${hostName}">(${hostName})</small>
        <small class="article-username">posted by ${story.username}</small>
      </li>
    `);

    return storyMarkup;
  }

  // create stories for the favorites list
  function createFaves() {
    $favStories.empty();

    for (let story of currentUser.favorites) {
      let favHtml = generateStoryHTML(story, false, true);
      $favStories.append(favHtml);
    }
  }

  function createOwnStories() {
    $ownStories.empty();

    for (let story of currentUser.ownStories) {
      let ownStoriesHtml = generateStoryHTML(story, true);
      $ownStories.append(ownStoriesHtml);
    }
  }

  /* hide all elements in elementsArr */

  function hideElements() {
    const elementsArr = [
      $submitForm,
      $allStoriesList,
      $filteredArticles,
      $ownStories,
      $loginForm,
      $createAccountForm,
      $favStories,
    ];
    elementsArr.forEach(($elem) => $elem.hide());
  }

  function showNavForLoggedInUser() {
    $navLogin.hide();
    $navLogOut.show();
    $userNav.show();
  }

  function isFavorite(story) {
    let favStoryIds = new Set();
    if (currentUser) {
      favStoryIds = new Set(currentUser.favorites.map((obj) => obj.storyId));
    }
    return favStoryIds.has(story.storyId);
  }

  /* simple function to pull the hostname from a URL */

  function getHostName(url) {
    let hostName;
    if (url.indexOf("://") > -1) {
      hostName = url.split("/")[2];
    } else {
      hostName = url.split("/")[0];
    }
    if (hostName.slice(0, 4) === "www.") {
      hostName = hostName.slice(4);
    }
    return hostName;
  }

  /* sync current user information to localStorage */

  function syncCurrentUserToLocalStorage() {
    if (currentUser) {
      localStorage.setItem("token", currentUser.loginToken);
      localStorage.setItem("username", currentUser.username);
    }
  }
});
