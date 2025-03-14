import {
//  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { 
    ICommandPalette, 
    MainAreaWidget,
//    WidgetTracker
} from '@jupyterlab/apputils';

import { Widget } from '@lumino/widgets';
import { Terminal } from '@jupyterlab/terminal';
import { IStatusBar } from '@jupyterlab/statusbar';

//const http = require('http');
//import * as http from 'http';

/**
 * Check the health of a service by making an HTTP GET request.
 * @param {number} port - The port to send the health check request to.
 * @returns {Promise<string>} - Resolves with the response data if successful.
 */
// const checkHealth = async (port: number) => {
//   const options = {
//     hostname: 'localhost',
//     port: port,
//     path: '/health',
//     method: 'GET',
//     headers: {
//       'Content-Type': 'application/json',
//     },
//   };

//   return new Promise((resolve, reject) => {
//     const req = http.request(options, (res: http.IncomingMessage) => {
//       let data = '';

//       // Collect data chunks
//       res.on('data', (chunk: Buffer) => {
//         data += chunk.toString(); // Convert Buffer to string
//       });

//       // Handle end of response
//       res.on('end', () => {
//         if (res.statusCode === 200) {
//           console.log(`Response from port ${port}: ${data}`);
//           resolve(data); // Successfully fetched the data
//         } else {
//           reject(new Error(`HTTP Status Code: ${res.statusCode} on port ${port}`));
//         }
//       });
//     });

//     // Handle request errors
//     req.on('error', (error: Error) => {
//       console.error(`Request error on port ${port}: ${error.message}`);
//       reject(error);
//     });

//     // End the request (required for it to be sent)
//     req.end();
//   });
// };



/**
 * Initialization data for the jupyterlab_bsshconn extension.
 */

// TODO: refactor the script, create a class
// TODO: allow stopping the model
// TODO: allow reloading the panel as in the astronomy tutorial


// async function checkServerConnection(terminal: Terminal): Promise<boolean> {
//     return new Promise((resolve) => {
//         const testMessage = 'echo $HOSTNAME\n';
//         let isConnected = false;

//         terminal.session.send({ type: 'stdin', content: [testMessage] });

//         terminal.session.messageReceived.connect((_, msg) => {
//             // TODO: use a parameter instead of 'login'
//             if (msg.content && msg.content.includes('login')) {
//                 isConnected = true;
//                 resolve(isConnected);
//             }
//         });
//         // Timeout after 2 seconds
//         setTimeout(() => resolve(isConnected), 2000);
//     });
// }

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab_bsshconn:plugin',
  description: 'A JupyterLab extension for SSH connections.',
  autoStart: true,
  optional: [ISettingRegistry, IStatusBar],
  requires: [ICommandPalette],
//  optional: [ILayoutRestorer],
  activate: async (
      app: JupyterFrontEnd, 
      palette: ICommandPalette, 
      settingRegistry: ISettingRegistry | null,
      statusBar: IStatusBar | null
  ) => {
    console.log('JupyterLab extension jupyterlab_bsshconn is activated!');
    console.log('ICommandPalette:', palette);

    // Create a status bar item
    let statusMessage = 'Ready';
    const statusWidget = new Widget();
    statusWidget.node.textContent = statusMessage;
    if (statusBar) {
      statusBar.registerStatusItem('ssh-connection-status', {
        align: 'left',
        item: statusWidget,
      });
    }

    // Define a widget creator function,
    // then call it to make a new widget
    const newWidget = () => {
      // Create a content widget with a form for SSH connection
      const content = new Widget();
      content.node.innerHTML = `
        <div style="padding: 20px;">
          <h2>SSH Connection</h2>
          <form id="ssh-form">
            <div style="margin-bottom: 10px;">
              <label for="username">Username:</label>
              <input type="text" id="username" name="username" style="width: 50%; padding: 8px;">
            </div>
            <div style="margin-bottom: 10px;">
              <label for="host">Host:</label>
              <input type=\"text\" id=\"host\" name=\"host\" value=\"login1.hb.hpc.rug.nl\" placeholder=\"e.g., login1.hb.hpc.rug.nl\" style="width: 50%; padding: 8px;">
            </div>
            <div style="margin-bottom: 10px;">
              <label for="password">Password:</label>
              <input type="password" id="password" name="password" style="width: 50%; padding: 8px;">
            </div>
            <div style="margin-bottom: 10px;">
              <label for="2fa">2FA Code:</label>
              <input type="text" id="twofa" name="twofa" style="width: 50%; padding: 8px;">
            </div>
            <div style="margin-top: 20px;">
                <button type="button" id="connect-button" style="padding: 10px 20px;">Connect</button>
                <button type="button" id="disconnect-button" style="padding: 10px 20px; margin-left: 10px;">Disconnect</button>
            </div>
          </form>
        </div>
      <div style="padding: 20px;">
        <h2>VLLM</h2>
        <form id="vllm-form">
          <div style="margin-bottom: 10px;">
            <label for="model-select">Select a Model:</label>
            <select id="model-select" name="model-select" style="width: 100%; padding: 8px;">
                <option value="google/gemma-2b">google/gemma-2b</option>
                <option value="mistralai/Mistral-7B-Instruct-v0.3">mistralai/Mistral-7B-Instruct-v0.3</option>
                <option value="neuralmagic/Meta-Llama-3.1-8B-Instruct-quantized.w8a16" selected>
                    neuralmagic/Meta-Llama-3.1-8B-Instruct-quantized.w8a16
                </option>
                <option value="Whisper">Whisper</option>
            </select>
          </div>
          <div style="margin-top: 20px;">
            <button type="button" id="run-model-button" style="padding: 10px 20px;">Run Model</button>
            <button type="button" id="stop-model-button" style="padding: 10px 20px; margin-left: 10px;">Stop Model</button>
          </div>
        </form>
      </div>
      `;

      // Variable to store the connection process state
      // let connectedToHPC = false;
      
      let jobid: string | null = null;
      let node: string | null = null;
      let port: string | null = null;

      // Add event listener for the Connect button
      const connectButton = content.node.querySelector('#connect-button') as HTMLButtonElement;
      const disconnectButton = content.node.querySelector('#disconnect-button') as HTMLButtonElement;

      const vllmForm = content.node.querySelector('#vllm-form') as HTMLFormElement;
      const runModelButton = content.node.querySelector('#run-model-button') as HTMLButtonElement;
      const stopModelButton = content.node.querySelector('#stop-model-button') as HTMLButtonElement;
      const modelSelect = content.node.querySelector('#model-select') as HTMLSelectElement;
        
      vllmForm.style.pointerEvents = 'none'; // Initially disable the form
      disconnectButton.disabled = true;

      // Declare terminal in a scope accessible to both event listeners
      let terminal: Terminal | null = null;
      let terminal2: Terminal | null = null;

      // TODO: investigate how to set the port in jupyter ai 'OPEN_API-BASE'
        
      connectButton?.addEventListener('click', async () => {
        const username = (content.node.querySelector('#username') as HTMLInputElement).value;
        const host = (content.node.querySelector('#host') as HTMLInputElement).value;
        const password = (content.node.querySelector('#password') as HTMLInputElement).value;
        const twoFactorCode = (content.node.querySelector('#twofa') as HTMLInputElement).value;

        if (!username || !host || !password || !twoFactorCode) {
          statusMessage = 'Please fill in all fields.';
          statusWidget.node.textContent = statusMessage;
          return;
        }

          
        try {

          const parentWidget = app.shell.currentWidget; // Capture the current active widget

          // Create a new terminal session using the terminal manager
          const terminalConnection = await app.serviceManager.terminals.startNew();
          const terminalConnection2 = await app.serviceManager.terminals.startNew();

          // Create a new terminal session
          terminal = new Terminal(terminalConnection);
          terminal.id = 'terminal-ssh-connection';

          app.shell.add(terminal, 'main');
          // app.shell.activateById(terminal.id);

          terminal2 = new Terminal(terminalConnection2);
          terminal2.id = 'terminal2-port-forwarding';
   
          app.shell.add(terminal2, 'main');
            
          // Re-focus on the parent widget
          if (parentWidget) {
              app.shell.activateById(parentWidget.id);
          }
        } catch (error) {
          console.error('Failed to create the terminals:', error);
          statusMessage = 'Failed to create the terminals. Closing the terminals.';
          statusWidget.node.textContent = statusMessage;
          if (terminal) {
            terminal.dispose();
          }
          if (terminal2) {
            terminal2.dispose();
          }
          vllmForm.style.pointerEvents = 'none'; // Disable the form on failure
        }
            
         // Attach a listener for messages received from the terminal
         terminal?.session.messageReceived.connect((_, message) => {
              if (message.type === 'stdout') {
                // console.log('STDOUT:', message.content);
                  
                  let terminalMessage = message.content?.join('') || '';
                  //  console.log('STDOUT:', terminalMessage);
                  // statusWidget.node.textContent = statusMessage;

                  // Handle SSH host authenticity prompt
                  if (terminalMessage.includes("Are you sure you want to continue connecting")) {
                    terminal?.session.send({ type: 'stdin', content: ['yes\n'] });
                  }
                  // Handle password prompt
                  else if (terminalMessage.toLowerCase().includes('password:')) {
                    terminal?.session.send({ type: 'stdin', content: [`${password}\n`] });
                  }
                  // Handle 2FA prompt
                  else if (terminalMessage.toLowerCase().includes('authenticator code')) {
                    terminal?.session.send({ type: 'stdin', content: [`${twoFactorCode}\n`] });
                  }
                  else if (terminalMessage.toLowerCase().includes('welcome to')) {
                      // TODO: implement a more robust success condition
                    // connectedToHPC = true;
                    statusMessage = 'SSH connection successful. You can now select and run a model.';
                    statusWidget.node.textContent = statusMessage;
                    vllmForm.style.pointerEvents = 'auto'; // Enable the form on success
                    stopModelButton.disabled = true;
                    disconnectButton.disabled = false;
                    connectButton.disabled = true;
                  }
                  // Extract jobid and node/host
                  else if (terminalMessage.includes('srun: Nodes') ) {
                    statusWidget.node.textContent = terminalMessage;
                    const nodeMatch = terminalMessage.match(/Nodes\s+(\S+)/);
                    const jobidMatch = terminalMessage.match(/jobid\s+(\d+)/);

                    if (nodeMatch) {
                        node = nodeMatch[1]
                        console.log("Node:", nodeMatch[1]); // Expected Output: a100gpu6
                    } else {
                        console.log("No node found");
                    }

                    if (jobidMatch) {
                        jobid = jobidMatch[1]
                        console.log("Job ID:", jobidMatch[1]); // Expected Output: 15505086
                    } else {
                        console.log("No job ID found");
                    }
                  } else if (terminalMessage.toLowerCase().includes('first task exited')) {
                      stopModelButton.disabled = true;
                      runModelButton.disabled = false;
                      modelSelect.disabled = false;
                      statusMessage = 'You can now select and run a model.';
                      console.log(statusMessage);
                      statusWidget.node.textContent = statusMessage;
                  } else if (terminalMessage.toLowerCase().includes('uvicorn running on')) {
                    // Extract the port where vLLM is served
                    const portMatch = terminalMessage.match(/http:\/\/\S+:(\d+)/);
                    if (portMatch) {
                        port = portMatch[1];
                        console.log('vLLM Port:', port);

                        // Trigger the SSH tunnel code if all details are ready
                        // TODO: find a better way to run this condition
                        if (jobid && node && port) {
                          console.log('All details found. Establishing SSH tunnel...');
                          const localPort = port;
                          stopModelButton.disabled = false;
                          console.log(`Port forwarding host: "${host}"`);
                          const sshCommand = `ssh -L 127.0.0.1:${localPort}:${node}:${port} ${username}@${host}`;
                          console.log(`Generated SSH Command: "${sshCommand}"`);
                          
                          // login1.hb.hpc.rug.nl71083:~/develop/bsshconn> ssh -L 8000:a100gpu6:8000
                          // number@login1.hb.hpc.rug.nl) Password: 
                          // bind [::1]:8000: Cannot assign requested address
                          // Welcome to the login1 node of the Hábrók cluster!
                          
                          // Create the ssh tunnel
                          terminal2?.session.send({
                               type: 'stdin',
                               content: [sshCommand + '\n'],
                          });
 
                        }
                    }
                  }
                  else if (terminalMessage.toLowerCase().includes('application startup complete')) {
                    statusMessage = 'vLLM up and running. You can now interact with the model.';
                    statusWidget.node.textContent = statusMessage;
                  }
              } else if (message.type === 'disconnect') {
                  statusMessage = 'Terminal disconnected.';
                  console.warn(statusMessage);
                  statusWidget.node.textContent = statusMessage;                
              } else {
                console.log('Message received:', message);
              }
          });

          // Attach a listener for messages received from terminal2
          terminal2?.session.messageReceived.connect((_, message) => {
                      if (message.type === 'stdout') {
                          let terminal2Message = message.content?.join('') || '';
                          // console.log('STDOUT:', statusMessage);
                          // statusWidget.node.textContent = statusMessage;

                          // Handle SSH host authenticity prompt
                          if (terminal2Message.includes("Are you sure you want to continue connecting")) {
                            terminal2?.session.send({ type: 'stdin', content: ['yes\n'] });
                          }
                          // Handle password prompt
                          else if (terminal2Message.toLowerCase().includes('password:')) {
                            terminal2?.session.send({ type: 'stdin', content: [`${password}\n`] });
                          }
                          // Handle 2FA prompt
                          else if (terminal2Message.toLowerCase().includes('authenticator code')) {
                            terminal2?.session.send({ type: 'stdin', content: [`${twoFactorCode}\n`] });
                          }
                          else if (terminal2Message.toLowerCase().includes('welcome to')) {
                            // connectedToHPC = true;
                            statusMessage = 'SSH tunnel established!';
                            statusWidget.node.textContent = statusMessage;
                            console.log('STDOUT:', statusMessage);
                            
                            // vllmForm.style.pointerEvents = 'none'; // Disable the form
                            // TODO: Is it better to disable when the user runs the model
                            // TODO: Test the VLLM api
                            // TODO: Enable it when the model is shutdown, allowing the user test another model
                          }
                      }
                    });

          // Initiate SSH connection process
          terminal?.session.send({ type: 'stdin', content: [`ssh ${username}@${host}\n`] });

      });

      runModelButton?.addEventListener('click', async () => {
        // TODO: set the token as en environment variable
        if (!terminal) {
          statusMessage = 'No active terminal. Cannot run model.';
          statusWidget.node.textContent = statusMessage;
          return;
        }

        const model = (content.node.querySelector('#model-select') as HTMLSelectElement).value;
        try {

          const command = model === "Whisper" 
              ? `/scratch/public/repro_containers/whisper/whisper_container.sh\n`
              : `/scratch/public/repro_containers/vllm_container_dynamic_port.sh ${model}\n`;
        
          terminal.session.send({
            type: 'stdin',
            content: [command],
          });
          
          statusMessage = `Starting model: ${model}`;
          statusWidget.node.textContent = statusMessage;
          modelSelect.disabled = true;
          runModelButton.disabled = true;
          
        } catch (error) {
          console.error('Failed to run the model:', error);
          statusMessage = 'Failed to run the model.';
          statusWidget.node.textContent = statusMessage;
        }
      });

// srun: Complete StepId=14456526.0 received
// slurmstepd: error: *** STEP 14456526.0 ON a100gpu1 CANCELLED AT 2024-12-31T23:30:56 ***
// srun: Received task exit notification for 1 task of StepId=14456526.0 (status=0x0009).
// srun: a100gpu1: task 0: Killed
// srun: Terminating StepId=14456526.0
// srun: First task exited. Terminating job in 15s


      stopModelButton?.addEventListener('click', async () => {

        // checkHealth(Number(port))
        //   .then((response) => {
        //         console.log('Health check passed:', response);

        //         // Close terminal2
        //         try {
        //           terminal2?.session.send({
        //             type: 'stdin',
        //             content: [`exit\n`, `exit\n`],
        //           });
        //           console.log('Successfully closed terminal2.');
        //         } catch (error) {
        //           console.error('Failed to stop the tunnel:', error);
        //           statusMessage = 'Failed to stop the tunnel.';
        //           statusWidget.node.textContent = statusMessage;
        //         }

        //         // Close terminal
        //         try {
        //           terminal?.session.send({
        //             type: 'stdin',
        //             content: [`\x03\x03`], // Double Ctrl+C to stop the process
        //           });
        //           console.log('Successfully closed terminal.');
        //         } catch (error) {
        //           console.error('Failed to stop the model:', error);
        //           statusMessage = 'Failed to stop the model.';
        //           statusWidget.node.textContent = statusMessage;
        //         }
        //       })
        //       .catch((error) => {
        //         console.error('Health check failed:', error.message);
        //       });
          
        // const healthUrl = `http://localhost:${port}/health`;
        const model = (content.node.querySelector('#model-select') as HTMLSelectElement).value;

        try {
          // Verify that the vLLM is up and running using 'healthUrl'
          // const response = await fetch(healthUrl);
          // const response = await fetch(healthUrl, {
          //   method: 'GET',
          //   credentials: 'include', // Sends cookies with the request
          // });
          // if (response.ok) {
            if (terminal2) {
              statusMessage = 'Stopping the tunnel.';
              statusWidget.node.textContent = statusMessage;
              console.log('STDOUT:', statusMessage);
              try {
                // const isConnected = await checkServerConnection(terminal2);
                // if (isConnected) {
                //     //TODO: use the 'scancel jobid' command to stop the vllm service
                // }
                terminal2.session.send({type: 'stdin', content: [`exit\n`],});
                if (terminal2) {
                    // Remove the widget from the shell
                    terminal2.dispose();
                }
                  // TODO: close terminal2
              } catch (error) {
                console.error('Failed to stop the tunnel:', error);
                statusMessage = 'Failed to stop the tunnel.';
                statusWidget.node.textContent = statusMessage;
              }
            }

            // The condition below may not be needed
            if (terminal) {
              statusMessage = `Stopping model: ${model}`;
              statusWidget.node.textContent = statusMessage;
              console.log('STDOUT:', statusMessage);
                // perhaps it is better to use scancel in terminal2
              try {
                terminal.session.send({type: 'stdin', content: [`\x03`], });
                terminal.session.send({type: 'stdin', content: [`\x03`], });
                  // TODO: find when the process is ended, close the terminal, update status bar and 
                  // activate/deactivate vllm-form elements
              } catch (error) {
                console.error('Failed to stop the model:', error);
                statusMessage = 'Failed to stop the model.';
                statusWidget.node.textContent = statusMessage;
              }
            }
          // } else {
          //   console.error(`Health check failed with status: ${response.status}`);
          //   statusMessage = 'Model health check failed.';
          //   statusWidget.node.textContent = statusMessage;
          // }
        } catch (error) {
          console.error('Failed to verify the health of the model:', error);
          statusMessage = 'Failed to verify the health of the model.';
          statusWidget.node.textContent = statusMessage;
        }
      });


      const widget = new MainAreaWidget({ content });
      widget.id = 'bsshconn-jupyterlab';
      widget.title.label = 'SSH Connection';
      widget.title.closable = true;

      return widget;
    };

    let widget = newWidget();

    // Add an application command
    const command: string = 'bsshconn:open';
    app.commands.addCommand(command, {
      label: 'SSH Connection',
      execute: () => {
        // Regenerate the widget if disposed
        if (widget.isDisposed) {
          widget = newWidget();
        }
        // if (!tracker.has(widget)) {
        // // Track the state of the widget for later restoration
        // tracker.add(widget);
        // }
        if (!widget.isAttached) {
          // Attach the widget to the main work area if it's not there
          app.shell.add(widget, 'main');
        }
        // Activate the widget
        app.shell.activateById(widget.id);
      }
    });

    // Add the command to the palette.
    palette.addItem({ command, category: 'Tutorial' });

    if (settingRegistry) {
      settingRegistry
        .load(plugin.id)
        .then(settings => {
          console.log('jupyterlab_bsshconn settings loaded:', settings.composite);
        })
        .catch(reason => {
          console.error('Failed to load settings for jupyterlab_bsshconn.', reason);
        });
    }
  }
};

export default plugin;
