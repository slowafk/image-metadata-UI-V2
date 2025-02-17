
        $shell = New-Object -ComObject Shell.Application
        $folder = Split-Path "C:\Users\slowe\image-tagger\backend\uploads\1739750866449-honey_1.png"
        $filename = Split-Path "C:\Users\slowe\image-tagger\backend\uploads\1739750866449-honey_1.png" -Leaf
        $shellFolder = $shell.Namespace($folder)
        $shellFile = $shellFolder.ParseName($filename)
        
        # Get Tags property
        $tags = $shellFolder.GetDetailsOf($shellFile, 18)
        
        @{
          tags = $tags
        } | ConvertTo-Json
            tags = $tags
        } | ConvertTo-Json
      