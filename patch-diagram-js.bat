call copy .\patches\dx-diagram.js  .\node_modules\devexpress-diagram\dist /y
call copy .\patches\dx-diagram.min.js  .\node_modules\devexpress-diagram\dist /y
IF EXIST .angular call rd .angular /s /q