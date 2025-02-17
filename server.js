// Initialize requires
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { Octokit } = require('octokit');

// Initialize express
const app = express();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    try {
      await fs.promises.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: function (req, file, cb) {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({ storage });

// Middleware setup
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.use(cors());
app.use(express.json());

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working' });
});

// GitHub configuration endpoint
app.post('/api/github-config', async (req, res) => {
  console.log('Received GitHub config request:', req.body);
  
  const { token, username, repo, branch, folder } = req.body;
  
  if (!token || !username || !repo) {
    console.log('Missing required fields');
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    console.log('Creating Octokit instance...');
    const octokit = new Octokit({ auth: token });
    
    console.log('Checking repository access...');
    await octokit.rest.repos.get({
      owner: username,
      repo: repo
    });

    console.log('GitHub configuration successful');
    res.json({ 
      success: true,
      message: 'GitHub configuration successful'
    });
  } catch (error) {
    console.error('GitHub verification error:', error);
    res.status(401).json({ 
      error: 'Failed to verify GitHub credentials',
      details: error.message 
    });
  }
});

// Add at the top with other constants
const METADATA_FIELDS = {
    'description': 0,     // Description field (contains tags)
    'title': 21,         // Title
    'subject': 3,        // Subject
    'comments': 6,       // Comments
    'authors': 20,       // Authors
    'dateCreated': 12,   // Date created
    // Add more fields as needed
};

// File upload endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('=== Starting Upload Process ===');
    
    if (!req.file) {
      throw new Error('No file uploaded');
    }

    if (!req.body.githubConfig) {
      throw new Error('GitHub configuration missing');
    }

    let githubConfig;
    try {
      githubConfig = JSON.parse(req.body.githubConfig);
      console.log('GitHub config parsed:', {
        username: githubConfig.username,
        repo: githubConfig.repo,
        branch: githubConfig.branch,
        folder: githubConfig.folder
      });
    } catch (error) {
      throw new Error('Invalid GitHub configuration: ' + error.message);
    }

    // Create Octokit instance early to check for existing files
    console.log('Creating Octokit instance...');
    const octokit = new Octokit({ auth: githubConfig.token });

    // Check if file already exists in the repository
    const githubPath = `${githubConfig.folder || 'images'}/${req.file.originalname}`;
    console.log('Checking if file exists:', githubPath);

    try {
      const { data: existingFile } = await octokit.rest.repos.getContent({
        owner: githubConfig.username,
        repo: githubConfig.repo,
        path: githubPath,
        branch: githubConfig.branch || 'main'
      });

      if (existingFile) {
        console.log('File already exists in repository');
        const githubUrl = `https://raw.githubusercontent.com/${githubConfig.username}/${githubConfig.repo}/${githubConfig.branch || 'main'}/${githubPath}`;
        
        const metadata = await extractMetadata(req.file);
        
        res.json({
          results: [{
            filename: req.file.originalname,
            path: req.file.path,
            metadata: metadata.metadata || {},
            githubUrl,
            message: `${req.file.originalname} already exists in repository, using existing file`
          }]
        });
        return;
      }
    } catch (error) {
      console.log('File does not exist in repository, proceeding with upload');
    }

    // Extract metadata
    console.log('Extracting metadata...');
    const metadata = await extractMetadata(req.file);

    // Upload to GitHub
    console.log('Reading file content...');
    const content = fs.readFileSync(req.file.path, { encoding: 'base64' });

    console.log('Uploading to GitHub:', githubPath);
    const result = await octokit.rest.repos.createOrUpdateFileContents({
      owner: githubConfig.username,
      repo: githubConfig.repo,
      path: githubPath,
      message: `Upload ${req.file.originalname}`,
      content: content,
      branch: githubConfig.branch || 'main'
    });

    console.log('GitHub upload successful');
    const githubUrl = `https://raw.githubusercontent.com/${githubConfig.username}/${githubConfig.repo}/${githubConfig.branch || 'main'}/${githubPath}`;

    res.json({
      results: [{
        filename: req.file.originalname,
        path: req.file.path,
        metadata: metadata.metadata || {},
        githubUrl,
        message: `Successfully uploaded ${req.file.originalname} to GitHub`
      }]
    });

  } catch (error) {
    console.error('Upload process error:', error);
    res.status(500).json({ 
      error: 'Failed to process file',
      details: error.message
    });
  } finally {
    // Clean up local file
    try {
      if (req.file && req.file.path) {
        fs.unlinkSync(req.file.path);
        console.log('Cleaned up local file:', req.file.path);
      }
    } catch (err) {
      console.warn(`Failed to clean up file ${req.file?.path}:`, err);
    }
  }
});

// Helper function to extract metadata (move existing PowerShell script here)
async function extractMetadata(file) {
  // Move the existing PowerShell script logic here
  const scriptPath = path.join(__dirname, 'temp-script.ps1');
  const scriptContent = `
Write-Output "Script starting..."
try {
    $shell = New-Object -ComObject Shell.Application
    Write-Output "Created Shell.Application"
    
    $filePath = "${file.path.replace(/\\/g, '\\\\')}"
    Write-Output "File path: $filePath"
    
    $folder = [System.IO.Path]::GetDirectoryName($filePath)
    $filename = [System.IO.Path]::GetFileName($filePath)
    Write-Output "Folder: $folder"
    Write-Output "Filename: $filename"
    
    $folderAbsolute = [System.IO.Path]::GetFullPath($folder)
    Write-Output "Absolute folder path: $folderAbsolute"
    
    $shellFolder = $shell.Namespace($folderAbsolute)
    if (-not $shellFolder) {
        Write-Output "Failed to get shell folder"
        Write-Output '{"success":false,"error":"Failed to access folder","metadata":null}'
        exit 1
    }
    Write-Output "Got shell folder"
    
    $shellFile = $shellFolder.ParseName($filename)
    if (-not $shellFile) {
        Write-Output "Failed to get shell file"
        Write-Output '{"success":false,"error":"Failed to access file","metadata":null}'
        exit 1
    }
    Write-Output "Got shell file"
    
    Write-Output "=== Property Details ==="
    $metadata = @{}
    
    # Try to get Description (index 0)
    $description = $shellFolder.GetDetailsOf($shellFile, 0)
    Write-Output "Description: $description"
    $metadata['description'] = $description
    
    # Try to get Title (index 21)
    $title = $shellFolder.GetDetailsOf($shellFile, 21)
    Write-Output "Title: $title"
    $metadata['title'] = $title
    
    # Try to get Comments (index 6)
    $comments = $shellFolder.GetDetailsOf($shellFile, 6)
    Write-Output "Comments: $comments"
    $metadata['comments'] = $comments
    
    # Try to get Tags (index 18)
    $tags = $shellFolder.GetDetailsOf($shellFile, 18)
    Write-Output "Tags: $tags"
    $metadata['tags'] = $tags
    
    Write-Output "=== End Property Details ==="
    
    $json = @{
        success = $true
        error = ""
        metadata = $metadata
    } | ConvertTo-Json -Compress
    
    Write-Output "JSON_OUTPUT_START"
    Write-Output $json
    Write-Output "JSON_OUTPUT_END"
}
catch {
    Write-Output "Error occurred: $_"
    Write-Output "Error details:"
    Write-Output $_.Exception
    Write-Output $_.ScriptStackTrace
    Write-Output '{"success":false,"error":"PowerShell error: $_","metadata":null}'
}
`;

  fs.writeFileSync(scriptPath, scriptContent);

  console.log('Executing PowerShell script...');
  const metadata = await new Promise((resolve, reject) => {
      const powershellProcess = exec(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`, {
          maxBuffer: 1024 * 1024 * 10
      }, (error, stdout, stderr) => {
          // Clean up the temporary script file
          try {
              fs.unlinkSync(scriptPath);
          } catch (err) {
              console.warn('Failed to clean up temporary script file:', err);
          }

          console.log('PowerShell execution completed');
          console.log('Error:', error);
          console.log('stdout:', stdout);
          console.log('stderr:', stderr);
          
          if (error) {
              console.error('PowerShell execution error:', error);
              reject(new Error(`PowerShell execution failed: ${error.message}`));
              return;
          }

          if (!stdout) {
              console.error('PowerShell produced no output');
              reject(new Error('PowerShell produced no output'));
              return;
          }

          try {
              // Look for JSON between markers
              const match = stdout.match(/JSON_OUTPUT_START\r?\n(.*)\r?\nJSON_OUTPUT_END/);
              if (!match) {
                  console.error('No JSON markers found in output');
                  console.error('Full stdout:', stdout);
                  
                  // Try to find any JSON-like string in the output
                  const jsonMatch = stdout.match(/\{.*\}/);
                  if (jsonMatch) {
                      console.log('Found JSON without markers:', jsonMatch[0]);
                      const parsed = JSON.parse(jsonMatch[0]);
                      resolve(parsed);
                      return;
                  }
                  
                  throw new Error('No valid JSON found in PowerShell output');
              }
              
              const jsonStr = match[1].trim();
              console.log('Found JSON string:', jsonStr);
              
              const parsed = JSON.parse(jsonStr);
              console.log('Successfully parsed metadata:', parsed);
              resolve(parsed);
          } catch (e) {
              console.error('JSON parsing error:', e);
              console.error('Error details:', {
                  message: e.message,
                  stack: e.stack
              });
              console.error('Raw stdout:', stdout);
              reject(new Error(`Failed to parse PowerShell output: ${e.message}`));
          }
      });

      powershellProcess.on('error', (error) => {
          console.error('PowerShell process error:', error);
      });

      powershellProcess.on('exit', (code, signal) => {
          console.log('PowerShell process exited with:', {
              code: code,
              signal: signal
          });
      });
  });

  if (!metadata.success) {
    throw new Error(metadata.error || 'Failed to read metadata');
  }

  return metadata;
}

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});