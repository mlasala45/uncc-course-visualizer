
# UNCC Course Visualizer

This [in-browser project](https://mlasala45.github.io/projects/uncc-course-visualizer/) downloads course listings and details from the UNCC course catalog, and displays them in a "tangled tree" format that visualizes their prerequisite structure. My hope is that it can be useful for gaining an overall understanding of the courses in a department, and planning what you need to take.

  ![enter image description here](http://mlasala45.github.io/images/repos-content/uncc-course-visualizer/preview.png)

## Usage

You can find a link to the live site at the top of this document. Press [Tab] to open the control panel, where you can select your options and retrieve course listings. The download process should take around 10-20s. Once courses are retrieved, they will be remembered for the remainder of the session. Reloading the graph with the "Reload Graph" button will only use courses that are already retrieved.

  

> [!NOTE]

> As of right now, course listings are not stored between sessions. If you reload, you will have to retrieve the courses again. This will be fixed in future updates.

  

### Getting around CORS to download course listings

  

> [!WARNING]

> You must follow one of these options to use the app. If you do not, it will always fail to retrieve courses.

  

CORS is a browser safety feature that lets servers specify what websites they expect to receive requests from. This is to prevent scams like a webpage accessing your bank in the background. The bank tells your browser that it should only be receiving requests from its own website, so your browser blocks the request.

  

For some reason, the UNCC course catalog is configured to only accept requests from their catalog page. Since this is browser-enforced, programs on your computer can ignore it, but browsers will refuse to talk to the catalog. Because of this, to download courses, you need to get around the CORS policy.

  

There are two main ways to do this:

#### Run your browser in unsafe mode

For Google Chrome (on Windows), you can run this command in command prompt:

`chrome.exe --user-data-dir="C:/Chrome Dev Session" --disable-web-security`

  

You will have to change directories to where `chrome.exe` is located first.

For me, that is: `cd "C:\Program Files\Google\Chrome\Application"`
If it's not that, google should be able to help you find your Chrome install location.

Running the command will open a new Chrome window in unsafe mode, which can use the website correctly.

  

#### Use a proxy

It's trivial to use a lightweight program called a "CORS proxy" to get around this issue. However, I'm not going to pay to have one running at all times so people can use this website 😔. So, you're either going to have to run one yourself, or find one online.

  

The website can be set to send all of its download requests to the proxy, and the proxy will immediately resend them to the actual catalog. Because it's a program, not a browser, it can ignore CORS. It passes the catalog response back to the website, and you get your course information.

  

I have a script for a lightweight CORS proxy using NodeJS hosted on my website. To run it, you will need to first install [NPM](https://www.npmjs.com/), a popular package manager web developers use to download things. Then, run:

`npx https://mlasala45.github.io/files/cors-proxy.tgz https://catalog.charlotte.edu`

  

The proxy is running! You can point the website to your proxy in the Network Settings tab in the control menu. By default, the proxy should run on `http://localhost:4000`.

  

##### Explanation

NPX is an command from NPM that runs scripts without having to separately download them.

If you like, you can download the `https://mlasala45.github.io/files/cors-proxy.tgz` file yourself and see what it's doing before you install it. A TGZ is basically just another kind of ZIP file. The `package.json` file installs the dependencies we need. The file in the `bin` folder loads up `ts-node`, a version of NodeJS that runs TypeScript (better, modern JavaScript), and then runs the actual `cors-proxy.ts` file that does the proxying.