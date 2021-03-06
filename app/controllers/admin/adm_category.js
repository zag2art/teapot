 /**
 * Module dependencies.
 */

var mongoose = require('mongoose')
  , async = require('async')
  , _ = require('underscore')
  //, Product = mongoose.model('Product')
  , Category = mongoose.model('Category')
  , nav = require('../../../config/navbar')

  ;


exports.create = function(req, res){

  var doc = new Category(req.body);
  doc.save(nav.init);

  //console.log(doc);

  res.redirect('/admin/category');

};

exports.new = function(req, res){
  res.locals.title = "Teapots - Создание категории"

  res.locals.bc_list = [{
    name: "Главная страница админки",
    href: "/admin"
  },{
    name: "Категории",
    href: "/admin/category"
  }];

  res.locals.sidebar = {categoryclass: "active"};

  res.locals.css = [
    'bootstrap-wysihtml5.css'
  ];

  res.locals.scripts = [
    '/js/lib/wysihtml5/wysihtml5-0.4.0pre.min.js',
    '/js/lib/wysihtml5/bootstrap-wysihtml5.js',
    '/js/lib/wysihtml5/bootstrap-wysihtml5.ru-RU.js',
    '/js/adm/adm.category.edit.js'
  ];


  res.locals.bc_active = 'Новая категория';

    // res.locals.scripts = [
    //   'adm.order.js'
    // ];

  res.render('admin/category/new', {
    layout: 'admin/layouts/default'

// ,
//     partials: {
//       adm_breadcrumb: 'admin/layouts/adm_breadcrumb',
//       adm_sidebar: 'admin/layouts/adm_sidebar',
//       adm_navbar: 'admin/layouts/adm_navbar',
//     }
  });


  // });

};

exports.edit = function(req, res){
  res.locals.title = "Teapots - Редактирование категории"

  res.locals.bc_list = [{
    name: "Главная страница админки",
    href: "/admin"
  },{
    name: "Категории",
    href: "/admin/category"
  }];

  res.locals.sidebar = {categoryclass: "active"};


  res.locals.css = [
    'bootstrap-wysihtml5.css'
  ];

  res.locals.scripts = [
    '/js/lib/wysihtml5/wysihtml5-0.4.0pre.min.js',
    '/js/lib/wysihtml5/bootstrap-wysihtml5.js',
    '/js/lib/wysihtml5/bootstrap-wysihtml5.ru-RU.js',
    '/js/adm/adm.category.edit.js'
  ];


  Category.findById(req.params.id).exec(function (err, docs) {

    //console.log('order - was here');

    if (err) return err;

    res.locals.category = docs;

    res.locals.bc_active = "Категория '"+docs.name+"'";

    // res.locals.scripts = [
    //   'adm.order.js'
    // ];

    res.render('admin/category/edit', {
      layout: 'admin/layouts/default'
      // ,
      // partials: {
      //   adm_breadcrumb: 'admin/layouts/adm_breadcrumb',
      //   adm_sidebar: 'admin/layouts/adm_sidebar',
      //   adm_navbar: 'admin/layouts/adm_navbar',
      // }
    });


  });


};

exports.update = function(req, res){

  //console.log('Old ', req.body);

  var obj = {}
    , id = req.body._id;

  delete req.body._id;



  var new_doc = Category.findByIdAndUpdate(id, req.body, function(err, saved) {

    if( err || !saved ) {
      console.log("Post not updated: "+err);
    } else {
      //console.log("Post updated: %s", saved);
    }
    nav.init();

  });

  res.redirect('/admin/category');
};

exports.delete = function(req, res){
  res.redirect('/admin');
};


exports.list = function(req, res){
  res.locals.title = "Teapots - Категории"

  res.locals.bc_list = [{
    name: "Главная страница админки",
    href: "/admin"
  }];

  res.locals.sidebar = {categoryclass: "active"};

  res.locals.bc_active = "Категории";

  Category.getAll(function (err, docs) {

    //console.log('order - was here');

    if (err) return err;

    res.locals.categories = docs;

    res.locals.scripts = [
       '/js/adm/adm.category.js'
    ];

    res.render('admin/category/list', {
      layout: 'admin/layouts/default'
      // ,
      // partials: {
      //   adm_breadcrumb: 'admin/layouts/adm_breadcrumb',
      //   adm_sidebar: 'admin/layouts/adm_sidebar',
      //   adm_navbar: 'admin/layouts/adm_navbar',
      // }
    });


  });



};
