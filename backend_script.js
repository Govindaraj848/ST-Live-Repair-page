
// ==========================================
// GOOGLE APPS SCRIPT CODE
// ==========================================

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); // Wait for up to 10 seconds for other requests to finish

  try {
    var data = JSON.parse(e.postData.contents);
    var ss;
    if (data.targetSheet) {
      try {
        ss = SpreadsheetApp.openByUrl(data.targetSheet);
      } catch (err) {
        ss = SpreadsheetApp.getActiveSpreadsheet();
      }
    } else {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }

    var sheet = ss.getSheets()[0];

    // =========================================================
    // ACTION 1: MARK EXPORTED (UPDATE EXISTING ROWS)
    // =========================================================
    if (data.action === 'markExported') {
      var rows = sheet.getDataRange().getValues();
      var itemsToUpdate = data.items;
      var batchNo = data.batchNo || '';
      var updatedCount = 0;
      
      var updateKeys = new Set();
      if (itemsToUpdate && itemsToUpdate.length > 0) {
        for (var k = 0; k < itemsToUpdate.length; k++) {
          var item = itemsToUpdate[k];
          var bc = String(item.barcode).replace(/^'/, '').trim();
          var tn = String(item.tranNo).trim();
          var rs = String(item.reason).trim();
          updateKeys.add(bc + "_" + tn + "_" + rs);
        }
      }

      for (var i = 1; i < rows.length; i++) {
        var row = rows[i];
        var sheetBc = String(row[3]).replace(/^'/, '').trim();
        var sheetTn = String(row[4]).trim();
        var sheetRs = String(row[6]).trim();
        var sheetKey = sheetBc + "_" + sheetTn + "_" + sheetRs;
        
        if (updateKeys.has(sheetKey)) {
           // Update Column 18 (Index 17, Col R in sheet) to "YES"
           sheet.getRange(i + 1, 18).setValue("YES");
           // Update Column 19 (Index 18, Col S in sheet) with Batch No
           if (batchNo) {
             sheet.getRange(i + 1, 19).setValue(batchNo);
           }
           updatedCount++;
        }
      }
      
      return ContentService
        .createTextOutput(JSON.stringify({ "result": "success", "updated": updatedCount }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // =========================================================
    // ACTION 2: SAVE NEW ROW (DEFAULT)
    // =========================================================
    else {
      // Append row ensuring "NO" lands at Column 18.
      // 1:timestamp, 2:designNo, 3:itemName, 4:barcode, 5:tranNo, 6:qty, 
      // 7:reason, 8:user, 9:serialNo, 10:discount, 
      // 11:style, 12:color, 13:polish, 14:size, 15:brand, 16:dummy7, 17:dummy8
      // 18: Export Status ("NO")
      // 19: Batch No (Initial empty)
      
      sheet.appendRow([
        data.timestamp,
        data.designNo,
        data.itemName,
        data.barcode,
        data.tranNo,
        data.qty,
        data.reason,
        data.user,
        data.serialNo || '',
        data.discount || '0',
        data.style || 'NA',
        data.color || 'NA',
        data.polish || 'NA',
        data.size || 'NA',
        data.brand || 'NA',
        data.dummy7 || 'NA',
        data.dummy8 || 'NA',
        "NO", // Col 18 Export Status (Index 17)
        ""    // Col 19 Batch No (Index 18)
      ]);

      return ContentService
        .createTextOutput(JSON.stringify({ "result": "success", "row": sheet.getLastRow() }))
        .setMimeType(ContentService.MimeType.JSON);
    }

  } catch (e) {
    return ContentService
      .createTextOutput(JSON.stringify({ "result": "error", "error": e.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
