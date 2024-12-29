import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { ICommandPalette, MainAreaWidget } from '@jupyterlab/apputils';

import { Widget } from '@lumino/widgets';
import { Terminal } from '@jupyterlab/terminal';
import { IStatusBar } from '@jupyterlab/statusbar';

/**
 * Initialization data for the jupyterlab_bsshconn extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab_bsshconn:plugin',
  description: 'A JupyterLab extension for SSH connections.',
  autoStart: true,
  optional: [ISettingRegistry, IStatusBar],
  requires: [ICommandPalette],
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
            </div>
            <div style="margin-bottom: 10px;">
              <label for="password">Password:</label>
              <input type="password" id="password" name="password" style="width: 50%; padding: 8px;">
            </div>
            <div style="margin-bottom: 10px;">
              <label for="2fa">2FA Code:</label>
              <input type="text" id="twofa" name="twofa" style="width: 50%; padding: 8px;">
            </div>
            <button type="button" id="connect-button" style="padding: 10px 20px;">Connect</button>
          </form>
        <h2>Running a VLLM</h2>
        <form id="vllm-form" style="padding: 20px;">
          <div style="margin-bottom: 10px;">
            <label for="model-select">Select a Model:</label>
            <select id="model-select" name="model-select" style="width: 100%; padding: 8px;">
                <option value="google/gemma-2b">google/gemma-2b</option>
                <option value="mistralai/Mistral-7B-v0.1">mistralai/Mistral-7B-v0.1</option>
                <option value="neuralmagic/Meta-Llama-3.1-8B-Instruct-quantized.w8a16" selected>
                    neuralmagic/Meta-Llama-3.1-8B-Instruct-quantized.w8a16
                </option>
            </select>
          </div>
          <div style="margin-top: 20px;">
            <button type="button" id="run-model-button" style="padding: 10px 20px;">Run Model</button>
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
      const vllmForm = content.node.querySelector('#vllm-form') as HTMLFormElement;
      const runModelButton = content.node.querySelector('#run-model-button') as HTMLButtonElement;

      vllmForm.style.pointerEvents = 'none'; // Initially disable the form

      // Declare terminal in a scope accessible to both event listeners
      let terminal: Terminal | null = null;
        
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

            // const terminalManager = new TerminalManager();
            // const terminalConnection = await terminalManager.startNew();
          // Create a new terminal session using the terminal manager
          const terminalConnection = await app.serviceManager.terminals.startNew();
          const terminalConnection2 = await app.serviceManager.terminals.startNew();

          // Create a new terminal session
          terminal = new Terminal(terminalConnection);
   
          app.shell.add(terminal, 'main');
          app.shell.activateById(terminal.id);
            
          // Attach a listener for messages received from the terminal
          terminal.session.messageReceived.connect((_, message) => {
              if (message.type === 'stdout') {
                  statusMessage = message.content?.join('') || '';
                  console.log('STDOUT:', statusMessage);
                  statusWidget.node.textContent = statusMessage;

                  // Handle SSH host authenticity prompt
                  if (statusMessage.includes("Are you sure you want to continue connecting")) {
                    terminal?.session.send({ type: 'stdin', content: ['yes\n'] });
                  }
                  // Handle password prompt
                  else if (statusMessage.toLowerCase().includes('password:')) {
                    terminal?.session.send({ type: 'stdin', content: [`${password}\n`] });
                  }
                  // Handle 2FA prompt
                  else if (statusMessage.toLowerCase().includes('authenticator code')) {
                    terminal?.session.send({ type: 'stdin', content: [`${twoFactorCode}\n`] });
                  }
                  else if (statusMessage.toLowerCase().includes('welcome to')) {
                    // connectedToHPC = true;
                    statusMessage = 'SSH connection successful.';
                    statusWidget.node.textContent = statusMessage;
                    vllmForm.style.pointerEvents = 'auto'; // Enable the form on success
                  }
                  // Extract jobid and node/host
                  else if (statusMessage.includes('job') || statusMessage.includes('nodes')) {
                    const jobMatch = statusMessage.match(/job (\d+)/);
                    const nodeMatch = statusMessage.match(/Nodes (\S+)/);
                    if (jobMatch) {
                        jobid = jobMatch[1];
                        console.log('Job ID:', jobid);
                    }
                    if (nodeMatch) {
                        node = nodeMatch[1];
                        console.log('Node/Host:', node);
                    }
                  }
                  // Extract the port where vLLM is served
                  else if (statusMessage.toLowerCase().includes('uvicorn running on')) {
                    const portMatch = statusMessage.match(/http:\/\/\S+:(\d+)/);
                    if (portMatch) {
                        port = portMatch[1];
                        console.log('vLLM Port:', port);
                    }
                  }

                  // Trigger the SSH tunnel code if all details are ready
                  if (jobid && node && port) {
                    console.log('All details found. Establishing SSH tunnel...');
                    const localPort = '8080';
                    const sshCommand = `ssh -L ${localPort}:${node}:${port} ${username}@${host}`;
                    // Create a new terminal session
                    const terminal2 = new Terminal(terminalConnection2);
   
                    app.shell.add(terminal2, 'main');
                    app.shell.activateById(terminal2.id);

                              // Attach a listener for messages received from the terminal
                    terminal2.session.messageReceived.connect((_, message) => {
                      if (message.type === 'stdout') {
                          statusMessage = message.content?.join('') || '';
                          console.log('STDOUT:', statusMessage);
                          statusWidget.node.textContent = statusMessage;

                          // Handle SSH host authenticity prompt
                          if (statusMessage.includes("Are you sure you want to continue connecting")) {
                            terminal2?.session.send({ type: 'stdin', content: ['yes\n'] });
                          }
                          // Handle password prompt
                          else if (statusMessage.toLowerCase().includes('password:')) {
                            terminal2?.session.send({ type: 'stdin', content: [`${password}\n`] });
                          }
                          // Handle 2FA prompt
                          else if (statusMessage.toLowerCase().includes('authenticator code')) {
                            terminal2?.session.send({ type: 'stdin', content: [`${twoFactorCode}\n`] });
                          }
                          else if (statusMessage.toLowerCase().includes('welcome to')) {
                            // connectedToHPC = true;
                            statusMessage = 'SSH tunnel established!';
                            statusWidget.node.textContent = statusMessage;
                            vllmForm.style.pointerEvents = 'none'; // Disable the form
                            // TODO: Is it better to disable when the user runs the model
                            // TODO: Test the VLLM api
                            // TODO: Enable it when the model is shutdown, allowing the user test another model
                          }
                      }
                    });

                    terminal2.session.send({
                        type: 'stdin',
                        content: [sshCommand + '\n'],
                    });
                }
              } else if (message.type === 'disconnect') {
                  statusMessage = 'Terminal disconnected.';
                  console.warn(statusMessage);
                  statusWidget.node.textContent = statusMessage;                
              } else {
                console.log('Message received:', message);
              }
          });

          // Initiate SSH connection process
          terminal.session.send({ type: 'stdin', content: [`ssh ${username}@${host}\n`] });

        } catch (error) {
          console.error('Failed to establish an SSH connection:', error);
          statusMessage = 'Failed to establish an SSH connection. Closing the terminal.';
          statusWidget.node.textContent = statusMessage;
          if (terminal) {
            terminal.dispose();
          }
          vllmForm.style.pointerEvents = 'none'; // Disable the form on failure
        }
      });

      runModelButton?.addEventListener('click', async () => {
        if (!terminal) {
          statusMessage = 'No active terminal. Cannot run model.';
          statusWidget.node.textContent = statusMessage;
          return;
        }

        const model = (content.node.querySelector('#model-select') as HTMLSelectElement).value;
        try {
          terminal.session.send({
            type: 'stdin',
            content: [`/scratch/public/repro_containers/vllm_container.sh ${model}\n`],
          });
          
          statusMessage = `Running model: ${model}`;
          statusWidget.node.textContent = statusMessage;
          
        } catch (error) {
          console.error('Failed to run the model:', error);
          statusMessage = 'Failed to run the model.';
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
